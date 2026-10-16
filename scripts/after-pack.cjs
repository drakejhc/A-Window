// Ad-hoc signs the macOS app after packaging. Apple Silicon Macs refuse to open an app whose signature
// was invalidated by packaging; an ad-hoc signature fixes that without a paid Apple Developer account.
// (People still need to right-click → Open the first time, because the app isn't notarized.)
const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" });
};
