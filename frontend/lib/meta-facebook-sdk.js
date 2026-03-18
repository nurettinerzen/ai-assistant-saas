const META_FACEBOOK_SDK_ID = 'meta-facebook-jssdk';
let sdkLoadPromise = null;

function initializeFacebookSdk({ appId, graphApiVersion }) {
  if (typeof window === 'undefined' || !window.FB?.init) {
    throw new Error('Meta Facebook SDK is not available.');
  }

  const existingConfig = window.__TELYX_META_SDK_CONFIG__ || {};
  const alreadyInitialized = window.__TELYX_META_SDK_INITIALIZED === true;

  if (!alreadyInitialized || existingConfig.appId !== appId || existingConfig.graphApiVersion !== graphApiVersion) {
    window.FB.init({
      appId,
      autoLogAppEvents: true,
      cookie: true,
      xfbml: false,
      version: graphApiVersion,
    });

    window.__TELYX_META_SDK_INITIALIZED = true;
    window.__TELYX_META_SDK_CONFIG__ = { appId, graphApiVersion };
  }

  return window.FB;
}

export async function loadMetaFacebookSdk({ appId, graphApiVersion = 'v22.0' }) {
  if (typeof window === 'undefined') {
    throw new Error('Meta Facebook SDK can only be loaded in the browser.');
  }

  if (!appId) {
    throw new Error('Meta app ID is required to initialize the Facebook SDK.');
  }

  if (window.FB?.init) {
    return initializeFacebookSdk({ appId, graphApiVersion });
  }

  if (!sdkLoadPromise) {
    sdkLoadPromise = new Promise((resolve, reject) => {
      window.fbAsyncInit = () => {
        try {
          resolve(window.FB);
        } catch (error) {
          sdkLoadPromise = null;
          reject(error);
        }
      };

      const existingScript = document.getElementById(META_FACEBOOK_SDK_ID);
      if (existingScript) {
        return;
      }

      const script = document.createElement('script');
      script.id = META_FACEBOOK_SDK_ID;
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onerror = () => {
        sdkLoadPromise = null;
        reject(new Error('Failed to load the Meta Facebook SDK.'));
      };

      document.body.appendChild(script);
    });
  }

  await sdkLoadPromise;
  return initializeFacebookSdk({ appId, graphApiVersion });
}
