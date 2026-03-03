/**
 * Script de vérification de santé du projet
 * À lancer : node scripts/healthCheck.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function checkDirectoryExists(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

async function runHealthCheck() {
  log('\n╔════════════════════════════════════════════════════╗', 'cyan');
  log('║     VÉRIFICATION DE SANTÉ - ORGA PRO              ║', 'cyan');
  log('╚════════════════════════════════════════════════════╝\n', 'cyan');

  let issuesFound = 0;

  // 1. Vérifier la structure de répertoires
  log('📁 Vérification de la structure...', 'blue');
  const requiredDirs = [
    'src/components',
    'src/modules',
    'src/models',
    'src/styles',
    'src/utils',
    'assets',
    'data',
    'tests',
    'public',
  ];

  requiredDirs.forEach((dir) => {
    if (checkDirectoryExists(dir)) {
      log(`  ✓ ${dir}`, 'green');
    } else {
      log(`  ✗ ${dir} - MANQUANT`, 'red');
      issuesFound++;
    }
  });

  // 2. Vérifier les fichiers essentiels
  log('\n📄 Vérification des fichiers essentiels...', 'blue');
  const requiredFiles = [
    'package.json',
    'src/index.js',
    'src/components/App.jsx',
    'public/electron.js',
    'public/index.html',
    '.eslintrc.json',
    'jest.config.js',
  ];

  requiredFiles.forEach((file) => {
    if (checkFileExists(file)) {
      log(`  ✓ ${file}`, 'green');
    } else {
      log(`  ✗ ${file} - MANQUANT`, 'red');
      issuesFound++;
    }
  });

  // 3. Vérifier les dépendances
  log('\n📦 Vérification des dépendances...', 'blue');
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const requiredDeps = ['react', 'react-dom', 'electron', 'xlsx'];

    requiredDeps.forEach((dep) => {
      if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
        log(`  ✓ ${dep}`, 'green');
      } else {
        log(`  ✗ ${dep} - NON INSTALLÉ`, 'red');
        issuesFound++;
      }
    });
  } catch (error) {
    log(`  ✗ Impossible de lire package.json`, 'red');
    issuesFound++;
  }

  // 4. Vérifier node_modules
  log('\n🔧 Vérification de node_modules...', 'blue');
  if (checkDirectoryExists('node_modules')) {
    const moduleCount = fs.readdirSync('node_modules').length;
    log(`  ✓ ${moduleCount} modules installés`, 'green');
  } else {
    log(`  ⚠ node_modules non trouvé - Exécutez: npm install`, 'yellow');
  }

  // 5. Configuration VS Code
  log('\n🎯 Vérification VS Code...', 'blue');
  if (checkFileExists('.vscode/settings.json')) {
    log(`  ✓ settings.json`, 'green');
  } else {
    log(`  ⚠ settings.json manquant`, 'yellow');
  }

  if (checkFileExists('.vscode/launch.json')) {
    log(`  ✓ launch.json (debug)`, 'green');
  } else {
    log(`  ⚠ launch.json manquant`, 'yellow');
  }

  if (checkFileExists('.vscode/tasks.json')) {
    log(`  ✓ tasks.json`, 'green');
  } else {
    log(`  ⚠ tasks.json manquant`, 'yellow');
  }

  // Résumé
  log('\n╔════════════════════════════════════════════════════╗', 'cyan');
  if (issuesFound === 0) {
    log('║     ✓ TOUT EST BON - PRÊT POUR LE DÉVELOPPEMENT ║', 'green');
  } else {
    log(`║     ✗ ${issuesFound} PROBLÈME(S) DÉTECTÉ(S)              ║`, 'red');
    log('║     Corrigez les problèmes listés ci-dessus      ║', 'yellow');
  }
  log('╚════════════════════════════════════════════════════╝\n', 'cyan');

  // Commandes recommandées
  log('💡 Commandes à exécuter :\n', 'cyan');
  if (!checkDirectoryExists('node_modules')) {
    log('  1. npm install', 'yellow');
    log('  2. npm run dev\n', 'yellow');
  } else {
    log('  npm run dev', 'yellow');
    log('  (Appuyez sur F12 dans Electron pour voir les logs)\n', 'yellow');
  }

  process.exit(issuesFound > 0 ? 1 : 0);
}

runHealthCheck().catch((error) => {
  log(`Erreur : ${error.message}`, 'red');
  process.exit(1);
});
