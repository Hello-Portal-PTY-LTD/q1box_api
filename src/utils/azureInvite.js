const { Client } = require("@microsoft/microsoft-graph-client");
const { ClientSecretCredential } = require("@azure/identity");

module.exports.azureInviteSent = async (email, name) => {
  return new Promise(async (resolve, reject) => {
    // Azure AD application (client) credentials
    const clientId = process.env.AZURE_AD_APP_CLIENT_ID;
    const clientSecret = process.env.AZURE_AD_APP_CLIENT_SECRET;
    const tenantId = process.env.AZURE_AD_TENANT_ID;

    const credential = new ClientSecretCredential(
      tenantId,
      clientId,
      clientSecret
    );

    const graphClient = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await credential.getToken(
            "https://graph.microsoft.com/.default"
          );
          return token.token;
        },
      },
    });

    // Define the invitation data
    const inviteData = {
      invitedUserEmailAddress: email,
      inviteRedirectUrl: process.env.APP_URL,
      invitedUserDisplayName: name,
      sendInvitationMessage: true,
    };

    try {
      const response = await graphClient.api("/invitations").post(inviteData);
      resolve(true); // Invitation sent successfully
    } catch (error) {
      reject(false); // Error occurred while sending invitation
    }
  });
};
