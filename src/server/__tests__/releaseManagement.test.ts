import request from 'supertest';
import express from 'express';
import apiRouter from '../routes/api';
import { AzureDevOpsService } from '../services/azureDevOps';

// Mock the AzureDevOpsService
jest.mock('../services/azureDevOps');

describe('Release Management API Routes', () => {
  let app: express.Application;
  let mockAdoService: jest.Mocked<AzureDevOpsService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create Express app with the API router
    app = express();
    app.use(express.json());
    app.use('/api', apiRouter);

    // Create mock service instance
    mockAdoService = {
      deleteWorkItem: jest.fn(),
      getReleaseVersions: jest.fn(),
      getReleaseEpics: jest.fn(),
      updateWorkItemField: jest.fn(),
      linkWorkItemsToEpic: jest.fn(),
    } as any;

    // Mock the constructor to return our mock instance
    (AzureDevOpsService as jest.MockedClass<typeof AzureDevOpsService>).mockImplementation(() => mockAdoService);
  });

  describe('DELETE /api/releases/:epicId', () => {
    it('should delete a release epic successfully', async () => {
      const epicId = 123;
      mockAdoService.deleteWorkItem.mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/api/releases/${epicId}`)
        .query({ project: 'TestProject', areaPath: 'TestArea' })
        .expect(200);

      expect(response.body).toEqual({ 
        success: true, 
        deletedEpicId: epicId 
      });
      expect(mockAdoService.deleteWorkItem).toHaveBeenCalledWith(epicId);
      expect(AzureDevOpsService).toHaveBeenCalledWith('TestProject', 'TestArea');
    });

    it('should return 400 for invalid epic ID', async () => {
      const response = await request(app)
        .delete('/api/releases/invalid')
        .query({ project: 'TestProject', areaPath: 'TestArea' })
        .expect(400);

      expect(response.body).toEqual({ error: 'Invalid epic ID' });
      expect(mockAdoService.deleteWorkItem).not.toHaveBeenCalled();
    });

    it('should handle deletion errors gracefully', async () => {
      const epicId = 456;
      mockAdoService.deleteWorkItem.mockRejectedValue(new Error('Deletion failed'));

      const response = await request(app)
        .delete(`/api/releases/${epicId}`)
        .query({ project: 'TestProject', areaPath: 'TestArea' })
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to delete release epic' });
      expect(mockAdoService.deleteWorkItem).toHaveBeenCalledWith(epicId);
    });

    it('should work without project and areaPath query params', async () => {
      const epicId = 789;
      mockAdoService.deleteWorkItem.mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/api/releases/${epicId}`)
        .expect(200);

      expect(response.body).toEqual({ 
        success: true, 
        deletedEpicId: epicId 
      });
      expect(AzureDevOpsService).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe('GET /api/releases', () => {
    it('should fetch release versions successfully', async () => {
      const mockVersions = ['v1.0.0', 'v1.1.0', 'v2.0.0'];
      mockAdoService.getReleaseVersions.mockResolvedValue(mockVersions);

      const response = await request(app)
        .get('/api/releases')
        .query({ project: 'TestProject', areaPath: 'TestArea' })
        .expect(200);

      expect(response.body).toEqual(mockVersions);
      expect(mockAdoService.getReleaseVersions).toHaveBeenCalled();
      expect(AzureDevOpsService).toHaveBeenCalledWith('TestProject', 'TestArea');
    });

    it('should return empty array when no releases found', async () => {
      mockAdoService.getReleaseVersions.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/releases')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should handle errors when fetching releases', async () => {
      mockAdoService.getReleaseVersions.mockRejectedValue(new Error('Query failed'));

      const response = await request(app)
        .get('/api/releases')
        .expect(500);

      expect(response.body).toEqual({ 
        error: 'Failed to fetch release versions',
        details: 'Query failed'
      });
    });
  });

  describe('GET /api/releases/epics', () => {
    it('should fetch release epics with progress', async () => {
      const mockEpics = [
        {
          id: 101,
          title: 'Release 1.0',
          version: 'v1.0.0',
          status: 'In Progress',
          progress: 50,
          completedItems: 5,
          totalItems: 10,
        },
        {
          id: 102,
          title: 'Release 2.0',
          version: 'v2.0.0',
          status: 'New',
          progress: 0,
          completedItems: 0,
          totalItems: 8,
        },
      ];

      mockAdoService.getReleaseEpics.mockResolvedValue(mockEpics as any);

      const response = await request(app)
        .get('/api/releases/epics')
        .query({ project: 'TestProject', areaPath: 'TestArea' })
        .expect(200);

      expect(response.body).toEqual(mockEpics);
      expect(mockAdoService.getReleaseEpics).toHaveBeenCalled();
    });
  });

  describe('PATCH /api/releases/:epicId', () => {
    it('should update release epic fields', async () => {
      const epicId = 123;
      const updateData = {
        targetDate: '2026-03-01',
        description: 'Updated description',
        project: 'TestProject',
        areaPath: 'TestArea',
      };

      mockAdoService.updateReleaseEpic = jest.fn().mockResolvedValue(undefined);

      const response = await request(app)
        .patch(`/api/releases/${epicId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockAdoService.updateReleaseEpic).toHaveBeenCalledWith(
        epicId,
        undefined, // title
        undefined, // startDate
        '2026-03-01', // targetDate
        'Updated description' // description
      );
    });

    it('should return 400 for invalid epic ID', async () => {
      const response = await request(app)
        .patch('/api/releases/invalid')
        .send({ targetDate: '2026-03-01' })
        .expect(400);

      expect(response.body).toEqual({ error: 'Invalid epic ID' });
    });
  });

  describe('POST /api/releases/:epicId/link', () => {
    it('should link work items to epic successfully', async () => {
      const epicId = 123;
      const workItemIds = [1, 2, 3];

      mockAdoService.linkWorkItemsToEpic.mockResolvedValue(undefined);

      const response = await request(app)
        .post(`/api/releases/${epicId}/link`)
        .send({ 
          workItemIds, 
          project: 'TestProject', 
          areaPath: 'TestArea' 
        })
        .expect(200);

      expect(response.body).toEqual({ 
        success: true, 
        linkedCount: 3 
      });
      expect(mockAdoService.linkWorkItemsToEpic).toHaveBeenCalledWith(epicId, workItemIds);
    });

    it('should return 400 when workItemIds is missing', async () => {
      const response = await request(app)
        .post('/api/releases/123/link')
        .send({})
        .expect(400);

      expect(response.body).toEqual({ error: 'workItemIds array is required' });
    });

    it('should return 400 when workItemIds is empty', async () => {
      const response = await request(app)
        .post('/api/releases/123/link')
        .send({ workItemIds: [] })
        .expect(400);

      expect(response.body).toEqual({ error: 'workItemIds array is required' });
    });
  });
});
