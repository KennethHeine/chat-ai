@description('Name of the Static Web App')
param staticWebAppName string

@description('Name of the Storage Account for AZURE_STORAGE_ACCOUNT setting')
param storageAccountName string

@secure()
@description('GitHub OAuth Client ID (from Key Vault)')
param githubClientId string

@secure()
@description('GitHub OAuth Client Secret (from Key Vault)')
param githubClientSecret string

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' existing = {
  name: staticWebAppName
}

resource appSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    AZURE_STORAGE_ACCOUNT: storageAccountName
    GITHUB_CLIENT_ID: githubClientId
    GITHUB_CLIENT_SECRET: githubClientSecret
  }
}
