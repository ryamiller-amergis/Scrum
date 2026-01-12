# Resource Group
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = merge(var.tags, { Environment = var.environment })
}

# App Service Plan
resource "azurerm_service_plan" "main" {
  name                = var.app_service_plan_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = "B1" # Basic tier - can be upgraded to S1, P1v2, etc.
  tags                = merge(var.tags, { Environment = var.environment })
}

# App Service
resource "azurerm_linux_web_app" "main" {
  name                = var.app_service_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.main.id
  https_only          = true
  tags                = merge(var.tags, { Environment = var.environment })

  site_config {
    always_on = true
    
    application_stack {
      node_version = "20-lts"
    }

    # Enable local logging
    app_command_line = "npm start"
  }

  app_settings = {
    "WEBSITE_NODE_DEFAULT_VERSION"           = "20-lts"
    "NODE_ENV"                               = "production"
    "ADO_ORG"                                = var.ado_org
    "ADO_PAT"                                = var.ado_pat
    "ADO_PROJECT"                            = var.ado_project
    "VITE_ADO_ORG"                           = var.ado_org
    "VITE_ADO_PROJECT"                       = var.ado_project
    "SCM_DO_BUILD_DURING_DEPLOYMENT"         = "true"
    "APPLICATIONINSIGHTS_CONNECTION_STRING"  = azurerm_application_insights.main.connection_string
  }

  logs {
    detailed_error_messages = true
    failed_request_tracing  = true

    http_logs {
      file_system {
        retention_in_days = 7
        retention_in_mb   = 35
      }
    }
  }
}

# Application Insights
resource "azurerm_application_insights" "main" {
  name                = "appi-${var.app_service_name}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  application_type    = "Node.JS"
  tags                = merge(var.tags, { Environment = var.environment })
}
