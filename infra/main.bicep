@description('Location for all resources')
param location string = 'westeurope'

@description('Name of the Static Web App')
param staticWebAppName string = 'swa-chat-ai'

@description('Name of the Storage Account for session data')
param storageAccountName string = 'st${uniqueString(resourceGroup().id)}sessions'

@description('Name of the Key Vault (must be deployed first via keyvault.bicep)')
param keyVaultName string = 'kv${uniqueString(resourceGroup().id)}chat'

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

// --- RBAC: Storage Table Data Contributor for SWA ---
// Allows the SWA managed functions to read/write/delete session entities
// via Managed Identity (no keys needed).
var storageTableDataContributorRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'

resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, staticWebApp.id, storageTableDataContributorRoleId)
  scope: storageAccount
  properties: {
    principalId: staticWebApp.identity.principalId
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      storageTableDataContributorRoleId
    )
    principalType: 'ServicePrincipal'
  }
}

// --- Key Vault: reference + RBAC ---
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Key Vault Secrets User — allows SWA managed identity to read secrets
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, staticWebApp.id, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    principalId: staticWebApp.identity.principalId
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      keyVaultSecretsUserRoleId
    )
    principalType: 'ServicePrincipal'
  }
}

// --- App Settings via Key Vault secret references ---
module swaAppSettings './modules/swa-appsettings.bicep' = {
  name: 'swa-appsettings'
  dependsOn: [kvRoleAssignment]
  params: {
    staticWebAppName: staticWebApp.name
    storageAccountName: storageAccount.name
    githubClientId: keyVault.getSecret('GitHubClientId')
    githubClientSecret: keyVault.getSecret('GitHubClientSecret')
  }
}

output staticWebAppName string = staticWebApp.name
output defaultHostname string = staticWebApp.properties.defaultHostname
output storageAccountName string = storageAccount.name
