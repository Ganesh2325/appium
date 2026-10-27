import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {symlink} from 'node:fs/promises';
import path from 'node:path';
import {afterEach, beforeEach, describe, it} from 'node:test';

import {env, fs, tempDir} from '@appium/support';

import {
  CACHE_DIR_RELATIVE_PATH,
  CURRENT_SCHEMA_REV,
  DRIVER_TYPE,
  PKG_HASHFILE_RELATIVE_PATH,
  PLUGIN_TYPE,
} from '../../../lib/constants';
import {INSTALL_TYPE_NPM} from '../../../lib/extension/extension-config';
import {Manifest} from '../../../lib/extension/manifest';

const HOISTED_DRIVER = 'appium-hoisted-driver';
const HOISTED_PLUGIN = '@appium-monorepo-test/hoisted-plugin';
const PEER_DRIVER = 'appium-peer-driver';
const LOCAL_DRIVER = 'appium-local-driver';
const UNDECLARED_DRIVER = 'appium-undeclared-driver';
const PLAIN_DEP = 'not-an-appium-extension';
const MISSING_DRIVER = 'appium-missing-driver';
const BROKEN_DRIVER = 'appium-broken-driver';

describe('Manifest extension discovery in a monorepo', function () {
  let root: string;
  let projectDir: string;
  let manifest: Manifest;

  beforeEach(async function () {
    root = await tempDir.openDir();
    projectDir = path.join(root, 'packages', 'my-app');
    await createMonorepo(root, projectDir);
    manifest = Manifest.getInstance(projectDir);
  });

  afterEach(async function () {
    Manifest.getInstance.cache = new Map();
    await fs.rimraf(root);
  });

  describe('when drivers are hoisted out of the project node_modules', function () {
    it('should register extensions declared by the project wherever they were hoisted', async function () {
      const changed = await manifest.syncWithInstalledExtensions(true);

      assert.strictEqual(changed, true);
      const drivers = manifest.getExtensionData(DRIVER_TYPE);
      const plugins = manifest.getExtensionData(PLUGIN_TYPE);

      assert.strictEqual(drivers.hoisted.pkgName, HOISTED_DRIVER);
      assert.strictEqual(drivers.hoisted.version, '7.1.0');
      assert.strictEqual(drivers.hoisted.installType, INSTALL_TYPE_NPM);
      assert.strictEqual(drivers.hoisted.installPath, path.join(root, 'node_modules', HOISTED_DRIVER));

      assert.strictEqual(drivers.peer.pkgName, PEER_DRIVER);
      assert.strictEqual(drivers.peer.installPath, path.join(root, 'node_modules', PEER_DRIVER));

      assert.strictEqual(plugins.hoisted.pkgName, HOISTED_PLUGIN);
      assert.strictEqual(plugins.hoisted.installPath, path.join(root, 'node_modules', HOISTED_PLUGIN));

      assert.strictEqual(drivers.local.pkgName, LOCAL_DRIVER);
      assert.strictEqual(drivers.local.installPath, path.join(projectDir, 'node_modules', LOCAL_DRIVER));

      assert.strictEqual(Object.hasOwn(drivers, 'undeclared'), false);
      assert.strictEqual(Object.hasOwn(drivers, 'plain'), false);
      assert.strictEqual(Object.hasOwn(drivers, 'missing'), false);
      assert.strictEqual(Object.hasOwn(drivers, 'broken'), false);
      assert.strictEqual(Object.hasOwn(plugins, 'plain'), false);
    });

    it('should not register the same extension twice', async function () {
      await manifest.syncWithInstalledExtensions(true);
      const changedAgain = await manifest.syncWithInstalledExtensions(true);
      assert.strictEqual(changedAgain, false);
      assert.strictEqual(Object.keys(manifest.getExtensionData(DRIVER_TYPE)).length, 3);
    });

    it('should ignore ancestor node_modules when the project is not an Appium project', async function () {
      const changed = await manifest.syncWithInstalledExtensions(false);
      const drivers = manifest.getExtensionData(DRIVER_TYPE);

      assert.strictEqual(changed, true);
      assert.strictEqual(drivers.local.pkgName, LOCAL_DRIVER);
      assert.strictEqual(Object.hasOwn(drivers, 'hoisted'), false);
      assert.strictEqual(Object.hasOwn(drivers, 'peer'), false);
      assert.strictEqual(Object.keys(manifest.getExtensionData(PLUGIN_TYPE)).length, 0);
    });

    it('should refresh a stale manifest and list hoisted drivers', async function () {
      const previousHome = process.env.APPIUM_HOME;
      delete process.env.APPIUM_HOME;
      env.resolveAppiumHome.cache = new Map();
      env.findAppiumDependencyPackage.cache = new Map();
      env.readPackageInDir.cache = new Map();
      try {
        // Home stays the nested workspace; the drivers themselves live at the repo root.
        assert.strictEqual(await env.resolveAppiumHome(projectDir), projectDir);
      } finally {
        if (previousHome === undefined) {
          delete process.env.APPIUM_HOME;
        } else {
          process.env.APPIUM_HOME = previousHome;
        }
      }

      await writeStaleManifest(projectDir);
      const data = await manifest.read();

      assert.strictEqual(data.drivers.hoisted.pkgName, HOISTED_DRIVER);
      assert.strictEqual(data.drivers.hoisted.installPath, path.join(root, 'node_modules', HOISTED_DRIVER));
      assert.strictEqual(data.plugins.hoisted.pkgName, HOISTED_PLUGIN);
      assert.strictEqual(Object.hasOwn(data.drivers, 'undeclared'), false);

      const reread = Manifest.getInstance(projectDir);
      const cached = await reread.read();
      assert.strictEqual(cached.drivers.hoisted.version, '7.1.0');
      assert.strictEqual(cached.drivers.local.pkgName, LOCAL_DRIVER);
    });
  });
});

/**
 * Layout from https://github.com/appium/appium/issues/19819:
 * the workspace package declares the drivers, and the package manager hoists them to the repo root.
 */
async function createMonorepo(root: string, projectDir: string): Promise<void> {
  const projectPkg = {
    name: 'my-app',
    version: '1.0.0',
    dependencies: {
      [PLAIN_DEP]: '1.0.0',
    },
    devDependencies: {
      appium: '^2.0.0',
      [HOISTED_DRIVER]: '^7.0.0',
      [LOCAL_DRIVER]: '1.0.0',
      [MISSING_DRIVER]: '1.0.0',
      [BROKEN_DRIVER]: '1.0.0',
    },
    optionalDependencies: {
      [HOISTED_PLUGIN]: '1.0.0',
    },
    peerDependencies: {
      [PEER_DRIVER]: '^1.0.0',
    },
  };

  await writePackage(projectDir, projectPkg);
  await writePackage(
    path.join(projectDir, 'node_modules', LOCAL_DRIVER),
    driverPackage(LOCAL_DRIVER, 'local', '1.0.0'),
  );

  const hoistedDriverDir = path.join(root, '.store', HOISTED_DRIVER);
  await writePackage(hoistedDriverDir, driverPackage(HOISTED_DRIVER, 'hoisted', '7.1.0'));
  const hoistedLink = path.join(root, 'node_modules', HOISTED_DRIVER);
  await fs.mkdirp(path.dirname(hoistedLink));
  await symlink(hoistedDriverDir, hoistedLink, 'dir');

  await writePackage(
    path.join(root, 'node_modules', HOISTED_PLUGIN),
    pluginPackage(HOISTED_PLUGIN, 'hoisted', '3.2.1'),
  );
  await writePackage(path.join(root, 'node_modules', PEER_DRIVER), driverPackage(PEER_DRIVER, 'peer', '1.4.0'));
  await writePackage(
    path.join(root, 'node_modules', UNDECLARED_DRIVER),
    driverPackage(UNDECLARED_DRIVER, 'undeclared', '9.9.9'),
  );
  await writePackage(path.join(root, 'node_modules', PLAIN_DEP), {
    name: PLAIN_DEP,
    version: '1.0.0',
    description: 'not an extension',
  });
  await fs.mkdirp(path.join(root, 'node_modules', BROKEN_DRIVER));
  await fs.writeFile(path.join(root, 'node_modules', BROKEN_DRIVER, 'package.json'), '{not json', 'utf8');
}

function driverPackage(name: string, driverName: string, version: string): Record<string, unknown> {
  return {
    name,
    version,
    appium: {
      driverName,
      automationName: driverName,
      platformNames: ['Fake'],
      mainClass: 'FakeDriver',
    },
    peerDependencies: {
      appium: '^2.0.0',
    },
  };
}

function pluginPackage(name: string, pluginName: string, version: string): Record<string, unknown> {
  return {
    name,
    version,
    appium: {
      pluginName,
      mainClass: 'FakePlugin',
    },
  };
}

async function writePackage(dir: string, pkg: Record<string, unknown>): Promise<void> {
  await fs.mkdirp(dir);
  await fs.writeFile(path.join(dir, 'package.json'), `${JSON.stringify(pkg)}\n`, 'utf8');
}

/**
 * Writes an empty manifest plus a package hash from before optional/peer deps were included.
 * That is the cache `appium driver list --installed` leaves behind after a failed monorepo scan.
 */
async function writeStaleManifest(projectDir: string): Promise<void> {
  const pkg = JSON.parse(await fs.readFile(path.join(projectDir, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const legacyHash = crypto
    .createHash('md5')
    .update(
      Buffer.from(
        JSON.stringify({
          dependencies: pkg.dependencies ?? {},
          devDependencies: pkg.devDependencies ?? {},
        }),
      ),
    )
    .digest('hex');
  const manifestPath = path.join(projectDir, CACHE_DIR_RELATIVE_PATH, 'extensions.yaml');
  await fs.mkdirp(path.dirname(manifestPath));
  await fs.writeFile(manifestPath, `drivers: {}\nplugins: {}\nschemaRev: ${CURRENT_SCHEMA_REV}\n`, 'utf8');
  await fs.writeFile(path.join(projectDir, PKG_HASHFILE_RELATIVE_PATH), legacyHash, 'utf8');
}
