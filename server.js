const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Azure DevOps configuration
const ADO_ORG = process.env.ADO_ORGANIZATION;
const ADO_PROJECT = process.env.ADO_PROJECT;
const ADO_PAT = process.env.ADO_PAT;

// Create base64 encoded auth header (only if PAT is configured)
const auth = ADO_PAT ? Buffer.from(`:${ADO_PAT}`).toString('base64') : null;

// Azure DevOps API helper
async function adoApiCall(method, url, data = null) {
  try {
    if (!auth) {
      throw new Error('Azure DevOps PAT is not configured');
    }
    
    const config = {
      method,
      url,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json-patch+json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('ADO API Error:', error.response?.data || error.message);
    throw error;
  }
}

// Get all PBIs with due dates
app.get('/api/pbis', async (req, res) => {
  try {
    if (!ADO_ORG || !ADO_PROJECT || !ADO_PAT) {
      return res.status(500).json({ 
        error: 'Azure DevOps configuration missing. Please check .env file.' 
      });
    }

    const wiqlQuery = {
      query: `SELECT [System.Id], [System.Title], [System.State], [Microsoft.VSTS.Scheduling.DueDate] 
              FROM WorkItems 
              WHERE [System.WorkItemType] = 'Product Backlog Item' 
              AND [System.TeamProject] = '${ADO_PROJECT}' 
              ORDER BY [Microsoft.VSTS.Scheduling.DueDate] DESC`
    };

    const wiqlUrl = `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/wiql?api-version=7.0`;
    const wiqlResult = await adoApiCall('POST', wiqlUrl, wiqlQuery);

    if (!wiqlResult.workItems || wiqlResult.workItems.length === 0) {
      return res.json([]);
    }

    // Get work item IDs
    const ids = wiqlResult.workItems.map(wi => wi.id).join(',');
    
    // Fetch full work item details
    const workItemsUrl = `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/workitems?ids=${ids}&api-version=7.0`;
    const workItems = await adoApiCall('GET', workItemsUrl);

    // Format the response
    const pbis = workItems.value.map(wi => ({
      id: wi.id,
      title: wi.fields['System.Title'],
      state: wi.fields['System.State'],
      dueDate: wi.fields['Microsoft.VSTS.Scheduling.DueDate'] || null,
      url: wi._links.html.href
    }));

    res.json(pbis);
  } catch (error) {
    console.error('Error fetching PBIs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch PBIs from Azure DevOps',
      details: error.message 
    });
  }
});

// Update PBI due date
app.patch('/api/pbis/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { dueDate } = req.body;

    if (!ADO_ORG || !ADO_PROJECT || !ADO_PAT) {
      return res.status(500).json({ 
        error: 'Azure DevOps configuration missing. Please check .env file.' 
      });
    }

    const updateUrl = `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/workitems/${id}?api-version=7.0`;
    
    const patchDocument = [
      {
        op: dueDate ? 'add' : 'remove',
        path: '/fields/Microsoft.VSTS.Scheduling.DueDate',
        value: dueDate
      }
    ];

    const result = await adoApiCall('PATCH', updateUrl, patchDocument);

    res.json({
      id: result.id,
      title: result.fields['System.Title'],
      state: result.fields['System.State'],
      dueDate: result.fields['Microsoft.VSTS.Scheduling.DueDate'] || null
    });
  } catch (error) {
    console.error('Error updating PBI:', error);
    res.status(500).json({ 
      error: 'Failed to update PBI in Azure DevOps',
      details: error.message 
    });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Scrum Calendar server running on http://localhost:${PORT}`);
  if (!ADO_ORG || !ADO_PROJECT || !ADO_PAT) {
    console.warn('WARNING: Azure DevOps configuration missing. Please create a .env file based on .env.example');
  }
});
