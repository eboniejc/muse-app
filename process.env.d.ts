type ProcessEnvShouldBeSuppliedByResources = {
SENDGRID_API_KEY: string;
JWT_SECRET: string;
OAUTH_CLIENT_ID: string;
OAUTH_CLIENT_SECRET: string;
DATABASE_URL: string;
ONESIGNAL_REST_API_KEY: string;
ONESIGNAL_APP_ID: string;
SHEETS_API_KEY: string;
NODE_ENV: string;
}

// Override the global process variable
declare var process: {
  env: ProcessEnvShouldBeSuppliedByResources & {
    MOBILE_APP_ID: string;
  };
};
