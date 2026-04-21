// ──────────────────────────────────────────────────────────────
//  server.js — API HTTP de IGCoin (versión para Render)
// ──────────────────────────────────────────────────────────────
//  Cambios respecto a la versión local:
//  - Puerto dinámico (Render lo asigna vía variable de entorno)
//  - Logs adaptados a la consola de Render
//  - Aviso claro cuando se está en modo efímero
// ──────────────────────────────────────────────────────────────

const express = require('express');
const fs = require('fs');
const path = require('path');
const { Blockchain } = require('./blockchain');

const app = express();

// CRÍTICO PARA RENDER: usar el puerto que Render asigna,
// con fallback a 3000 para desarrollo local.
const PORT = process.env.PORT || 3000;

const LEDGER_FILE = path.join(__dirname, 'blockchain.json');

// Middleware: permite recibir y enviar JSON
app.use(express.json());

// Middleware CORS: permite que módulos de los Equipos A y B
// llamen a esta API desde cualquier origen.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Archivos estáticos: el panel de visualización está en /public
app.use(express.static(path.join(__dirname, 'public')));

// ── Creamos la blockchain ────────────────────────────────────
const igcoin = new Blockchain();

// ⚠ IMPORTANTE EN RENDER ⚠
// El plan free de Render usa filesystem efímero: cuando el servicio
// se duerme (15 minutos sin tráfico), todos los archivos se borran.
// Esto significa que blockchain.json NO sobrevive a los reinicios.
// Para persistencia real en producción, migrar a una base de datos
// como Supabase. Para demos y pruebas, esto está OK.
if (fs.existsSync(LEDGER_FILE)) {
  try {
    const datos = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
    igcoin.chain = datos.chain;
    igcoin.transaccionesPendientes = datos.transaccionesPendientes || [];
    console.log(`✓ Cadena cargada del archivo (${igcoin.chain.length} bloques)`);
  } catch (e) {
    console.log('⚠ No se pudo cargar el archivo, usando cadena nueva');
  }
} else {
  console.log('ℹ Sin archivo previo. Iniciando con cadena nueva (solo bloque génesis).');
}

function guardarLedger() {
  try {
    fs.writeFileSync(LEDGER_FILE, JSON.stringify({
      chain: igcoin.chain,
      transaccionesPendientes: igcoin.transaccionesPendientes
    }, null, 2));
  } catch (e) {
    console.log('⚠ No se pudo guardar el ledger:', e.message);
  }
}

// ══════════════════════════════════════════════════════════════
//  ENDPOINTS DE LA API
// ══════════════════════════════════════════════════════════════

// Endpoint de salud para que Render verifique que el servicio está vivo
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bloques: igcoin.chain.length,
    timestamp: new Date().toISOString()
  });
});

// GET /chain — devuelve la cadena completa
app.get('/chain', (req, res) => {
  res.json({
    chain: igcoin.chain,
    length: igcoin.chain.length
  });
});

// GET /chain/valid — verifica si la cadena está íntegra
app.get('/chain/valid', (req, res) => {
  res.json(igcoin.esValida());
});

// POST /transactions/new — registra una nueva transacción
app.post('/transactions/new', (req, res) => {
  const { sender, recipient, amount } = req.body;

  if (!sender || !recipient || amount === undefined) {
    return res.status(400).json({
      error: 'Faltan datos. Se requieren: sender, recipient, amount'
    });
  }

  // Validación de saldo (excepto para cargas iniciales desde GENESIS)
  if (sender !== 'GENESIS') {
    const saldo = igcoin.calcularSaldo(sender);
    if (saldo < amount) {
      return res.status(400).json({
        error: `Saldo insuficiente. Tenés ${saldo} IGCoins, querés enviar ${amount}`
      });
    }
  }

  try {
    const indiceBloque = igcoin.agregarTransaccion(sender, recipient, amount);
    igcoin.minarBloque();
    guardarLedger();

    res.json({
      message: `Transacción registrada en el bloque ${indiceBloque}`,
      transaction: { sender, recipient, amount }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /mine — minado manual
app.post('/mine', (req, res) => {
  const nuevoBloque = igcoin.minarBloque();
  if (!nuevoBloque) {
    return res.json({ message: 'No hay transacciones pendientes para minar' });
  }
  guardarLedger();
  res.json({
    message: 'Bloque minado exitosamente',
    bloque: nuevoBloque
  });
});

// GET /wallet/:id/saldo — saldo de una wallet
app.get('/wallet/:id/saldo', (req, res) => {
  const walletId = req.params.id;
  const saldo = igcoin.calcularSaldo(walletId);
  res.json({ wallet: walletId, saldo });
});

// GET /wallet/:id/historial — historial de transacciones
app.get('/wallet/:id/historial', (req, res) => {
  const walletId = req.params.id;
  const historial = igcoin.obtenerHistorial(walletId);
  res.json({ wallet: walletId, historial });
});

// GET /ranking — ranking de proyectos
app.get('/ranking', (req, res) => {
  res.json({ ranking: igcoin.obtenerRanking() });
});

// POST /wallet/crear — crear wallet con saldo inicial
app.post('/wallet/crear', (req, res) => {
  const { walletId, saldoInicial = 100 } = req.body;
  if (!walletId) {
    return res.status(400).json({ error: 'Se requiere walletId' });
  }
  try {
    igcoin.agregarTransaccion('GENESIS', walletId, saldoInicial);
    igcoin.minarBloque();
    guardarLedger();
    res.json({
      message: `Wallet ${walletId} creada con ${saldoInicial} IGCoins`,
      walletId, saldoInicial
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /demo/alterar-bloque — solo para demo
app.post('/demo/alterar-bloque', (req, res) => {
  const { indice, nuevoMonto } = req.body;
  if (!igcoin.chain[indice] || !igcoin.chain[indice].transactions[0]) {
    return res.status(400).json({ error: 'Bloque o transacción no encontrados' });
  }
  const valorAnterior = igcoin.chain[indice].transactions[0].amount;
  igcoin.chain[indice].transactions[0].amount = nuevoMonto;
  res.json({
    message: '⚠ Bloque alterado manualmente',
    bloque: indice,
    valorAnterior,
    valorNuevo: nuevoMonto,
    aviso: 'Llamá a GET /chain/valid para ver cómo el sistema detecta la alteración'
  });
});

// ── Arrancamos el servidor ───────────────────────────────────
// Render requiere que el servidor escuche en 0.0.0.0
app.listen(PORT, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════════════');
  console.log('  IGCoin Backend');
  console.log(`  Puerto: ${PORT}`);
  console.log(`  Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log('═══════════════════════════════════════════════');
  console.log('  Endpoints disponibles:');
  console.log('    GET  /health');
  console.log('    GET  /chain');
  console.log('    GET  /chain/valid');
  console.log('    POST /transactions/new');
  console.log('    POST /mine');
  console.log('    GET  /wallet/:id/saldo');
  console.log('    GET  /wallet/:id/historial');
  console.log('    GET  /ranking');
  console.log('    POST /wallet/crear');
  console.log('═══════════════════════════════════════════════');
});
