@description('Location for all resources')
param location string = 'westeurope'

@description('Name of the Static Web App')
param staticWebAppName string = 'swa-chat-ai'

@description('Name of the Storage Account for session data')
param storageAccountName string = 'stchataisessions'

@description('Environment tag for resource management')
param environment string = 'production'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: {
    project: 'chat-ai'
    environment: environment
  }
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource sessionsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'sessions'
}

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: location
  tags: {
    project: 'chat-ai'
    environment: environment
  }
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Storage Table Data Contributor — allows the SWA managed functions to
// read/write/delete session entities via Managed Identity (no keys needed).
var storageTableDataContributorRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, staticWebApp.id, storageTableDataContributorRoleId)
  scope: storageAccount
  properties: {
    principalId: staticWebApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableDataContributorRoleId)
    principalType: 'ServicePrincipal'
  }
}

output staticWebAppName string = staticWebApp.name
output defaultHostname string = staticWebApp.properties.defaultHostname
output storageAccountName string = storageAccount.name
