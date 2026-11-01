export const REPO_CONFIG = {
  owner: 'tapos-linx',
  repo: 'LRgetBD-Pro',
  fullSlug: 'tapos-linx/LRgetBD-Pro',
  appName: 'LRgetBD Pro',
  appId: 'bd.landarchive.lrgetbdpro',
  standardApkFilename: 'LRgetBD-Pro.apk',
  minValidApkSizeBytes: 1048576, // 1 MB (1,048,576 bytes)
  releasesApiEndpoint: 'https://api.github.com/repos/tapos-linx/LRgetBD-Pro/releases/latest',
  directFallbackAssetUrl:
    'https://github.com/tapos-linx/LRgetBD-Pro/releases/latest/download/LRgetBD-Pro.apk',
  actionsUrl: 'https://github.com/tapos-linx/LRgetBD-Pro/actions',
  releasesPageUrl: 'https://github.com/tapos-linx/LRgetBD-Pro/releases',
  workflowFilePath: '.github/workflows/build-apk.yml',
  repoStorageKey: 'lrgetbd_pro_repo_slug_v2',
} as const;

export function buildRepoEndpoints(slug: string = REPO_CONFIG.fullSlug) {
  const cleaned = slug.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  const owner = parts[0] || REPO_CONFIG.owner;
  const repo = parts[1] || REPO_CONFIG.repo;
  const fullSlug = `${owner}/${repo}`;

  return {
    owner,
    repo,
    fullSlug,
    releasesApiEndpoint: `https://api.github.com/repos/${fullSlug}/releases/latest`,
    directFallbackAssetUrl: `https://github.com/${fullSlug}/releases/latest/download/${REPO_CONFIG.standardApkFilename}`,
    actionsUrl: `https://github.com/${fullSlug}/actions`,
    releasesPageUrl: `https://github.com/${fullSlug}/releases`,
  };
}

export const GITHUB_ACTIONS_APK_WORKFLOW_YAML = `name: Build, Sign & Release LRgetBD-Pro APK

on:
  push:
    branches: [ "main", "master" ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-android-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Java JDK 21 (Temurin)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Build Web Assets & Ensure Native Android Project Exists
        run: |
          if [ -f "package.json" ]; then
            npm install --legacy-peer-deps
            npm run build
            if [ ! -d "android" ] && [ ! -f "gradlew" ]; then
              npm install @capacitor/core @capacitor/cli @capacitor/android --save-dev --legacy-peer-deps
              cat << 'EOF' > capacitor.config.json
              {
                "appId": "bd.landarchive.lrgetbdpro",
                "appName": "LRgetBD Pro",
                "webDir": "dist",
                "server": {
                  "androidScheme": "https"
                },
                "plugins": {
                  "CapacitorHttp": {
                    "enabled": true
                  }
                }
              }
              EOF
              npx cap add android
            fi
            if [ -d "android" ]; then
              npx cap sync android
            fi
          fi

      - name: Grant Gradle Execute Permissions & Build Debug APK
        run: |
          if [ -f "gradlew" ]; then
            chmod +x gradlew
            ./gradlew assembleDebug --no-daemon
          elif [ -f "android/gradlew" ]; then
            chmod +x android/gradlew
            cd android
            ./gradlew assembleDebug --no-daemon
          else
            echo "ERROR: No gradlew found in root or android/ directory!"
            exit 1
          fi

      - name: Locate Built APK, Verify Integrity (> 1MB) & Copy to LRgetBD-Pro.apk
        run: |
          if [ -f "app/build/outputs/apk/debug/app-debug.apk" ]; then
            APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
          elif [ -f "android/app/build/outputs/apk/debug/app-debug.apk" ]; then
            APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
          else
            echo "ERROR: app-debug.apk was not generated!"
            exit 1
          fi
          FILE_SIZE=$(stat -c%s "$APK_PATH")
          if [ "$FILE_SIZE" -lt 1048576 ]; then
            echo "ERROR: APK file is smaller than 1MB ($FILE_SIZE bytes) - corrupted build!"
            exit 1
          fi
          cp "$APK_PATH" ./LRgetBD-Pro.apk

      - name: Upload LRgetBD-Pro.apk to Workflow Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: LRgetBD-Pro-APK
          path: ./LRgetBD-Pro.apk

      - name: Publish LRgetBD-Pro.apk to GitHub Releases (Latest)
        uses: softprops/action-gh-release@v2
        with:
          tag_name: v1.0.\${{ github.run_number }}
          name: "LRgetBD Pro v1.0.\${{ github.run_number }} (Production Android APK)"
          body: |
            ### LRgetBD Pro — Official Android APK Release (Build #\${{ github.run_number }})
            * **Direct APK Download:** [\`LRgetBD-Pro.apk\`](https://github.com/tapos-linx/LRgetBD-Pro/releases/latest/download/LRgetBD-Pro.apk)
            * **Android Package ID:** \`bd.landarchive.lrgetbdpro\`
            * **Native CORS Bypass Enabled:** Built with \`CapacitorHttp\` enabled for direct \`https://eporcha.tech\` extraction.
          files: ./LRgetBD-Pro.apk
          draft: false
          prerelease: false
          make_latest: true
`;
