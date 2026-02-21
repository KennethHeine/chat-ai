@description('Location for the Static Web App')
param location string = 'westeurope'

@description('Name of the Static Web App')
param staticWebAppName string = 'swa-chat-ai'

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: location
  tags: {
    project: 'chat-ai'
    environment: 'production'
  }
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
  }
}

output staticWebAppName string = staticWebApp.name
output defaultHostname string = staticWebApp.properties.defaultHostname
