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

export const GITHUB_ACTIONS_APK_WORKFLOW_YAML = `name: Build & Verify LRgetBD-Pro Capacitor Android Debug APK

on:
  push:
    branches: [ "main", "master" ]
  pull_request:
    branches: [ "main", "master" ]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build-android-apk:
    name: Build & Verify Android Debug APK
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Setup Bun (Matches bun.lock)
        uses: oven-sh/setup-bun@v2

      - name: Setup Java JDK 21 (Temurin)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'

      - name: Setup Android SDK Command-Line Tools
        uses: android-actions/setup-android@v4

      - name: Accept Android SDK Licenses & Install Required SDK Packages
        run: |
          yes | sdkmanager --licenses > /dev/null
          sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"

      - name: Setup Gradle Caching
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-home-cache-cleanup: true

      - name: Install Dependencies, Type-Check & Run Complete Test Suite
        run: |
          bun install --frozen-lockfile
          npm run lint
          npm test

      - name: Build Production Web Bundle & Sync Capacitor Android Assets
        run: |
          npm run build
          npx cap sync android
          cmp -s dist/index.html android/app/src/main/assets/public/index.html

      - name: Build Android Debug APK & Run Android Unit Tests
        working-directory: android
        run: |
          chmod +x ./gradlew
          ./gradlew --version --no-daemon
          ./gradlew testDebugUnitTest assembleDebug --no-daemon

      - name: Validate Debug APK Identity, Signature & SHA-256
        run: |
          APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
          test -s "$APK_PATH"
          unzip -tq "$APK_PATH"
          SDK_ROOT="\${ANDROID_HOME:-\$ANDROID_SDK_ROOT}"
          BUILD_TOOLS_DIR=\$(ls -d "$SDK_ROOT/build-tools/"* | sort -V | tail -n 1)
          "$BUILD_TOOLS_DIR/aapt2" dump badging "$APK_PATH" | grep -q "package: name='bd.landarchive.lrgetbdpro'"
          "$BUILD_TOOLS_DIR/apksigner" verify --verbose "$APK_PATH"
          cp "$APK_PATH" ./LRgetBD-Pro-debug.apk
          sha256sum ./LRgetBD-Pro-debug.apk > ./LRgetBD-Pro-debug.apk.sha256

      - name: Upload Verified Debug APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: LRgetBD-Pro-Debug-APK
          if-no-files-found: error
          path: |
            ./LRgetBD-Pro-debug.apk
            ./LRgetBD-Pro-debug.apk.sha256
            ./build-metadata.json
`;
