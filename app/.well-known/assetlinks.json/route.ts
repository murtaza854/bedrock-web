// Tells Android that the Bedrock phone app may use this site's passkeys. The fingerprint is the app's signing key (not a secret);
// it must match ANDROID_KEY_SHA256 on the API. (A route, not a file in public/, because the standalone build does not copy public/.)
export const dynamic = "force-static";
export const GET = () => Response.json([{
  relation: ["delegate_permission/common.get_login_creds", "delegate_permission/common.handle_all_urls"],
  target: { namespace: "android_app", package_name: "com.tech2olabs.bedrock_mobile", sha256_cert_fingerprints: ["88:6B:B8:99:54:72:AB:C7:D5:29:50:6B:1B:6D:53:BF:BA:41:F1:9D:22:3B:31:79:4C:FB:EB:C8:72:40:9B:D9"] },
}]);
