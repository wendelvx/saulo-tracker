const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');

const app = express();
const db = new Database('database.sqlite');

// Habilita chaves estrangeiras no SQLite (fundamental para o ON DELETE CASCADE funcionar)
db.pragma('foreign_keys = ON');

app.use(cors());
app.use(express.json());

/**
 * 1. INICIALIZAÇÃO DO BANCO
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS treinos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    duracao_total INTEGER NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blocos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    treino_id INTEGER,
    tempo_inicial INTEGER NOT NULL,
    tempo_final INTEGER NOT NULL,
    intensidade INTEGER NOT NULL,
    rpm INTEGER NOT NULL DEFAULT 80,
    exercicio TEXT,
    FOREIGN KEY(treino_id) REFERENCES treinos(id) ON DELETE CASCADE
  );
`);

/**
 * 2. PREPARAÇÃO DE STATEMENTS (Performance & Reuso)
 * Compilados em tempo de inicialização para latência zero nas requisições.
 */
const selectAllTreinos = db.prepare('SELECT * FROM treinos ORDER BY criado_em DESC');
const selectTreinoById = db.prepare('SELECT * FROM treinos WHERE id = ?'); // OTIZIMADO: Statement em cache
const selectBlocksByTreino = db.prepare('SELECT * FROM blocos WHERE treino_id = ? ORDER BY tempo_inicial ASC');
const deleteTreino = db.prepare('DELETE FROM treinos WHERE id = ?');
const deleteBlocksByTreino = db.prepare('DELETE FROM blocos WHERE treino_id = ?');
const insertTreino = db.prepare('INSERT INTO treinos (nome, duracao_total) VALUES (?, ?)');
const updateTreinoBase = db.prepare('UPDATE treinos SET nome = ?, duracao_total = ? WHERE id = ?');
const insertBloco = db.prepare('INSERT INTO blocos (treino_id, tempo_inicial, tempo_final, intensidade, exercicio, rpm) VALUES (?, ?, ?, ?, ?, ?)');

/**
 * 3. ENDPOINTS
 */

// LISTAR TODOS OS TREINOS
app.get('/api/treinos', (req, res) => {
  try {
    const treinos = selectAllTreinos.all();
    const data = treinos.map(t => ({
      ...t,
      blocos: selectBlocksByTreino.all(t.id)
    }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar treinos", details: err.message });
  }
});

// BUSCAR UM TREINO ESPECÍFICO
app.get('/api/treinos/:id', (req, res) => {
  try {
    // Utilizando o statement pré-compilado
    const treino = selectTreinoById.get(req.params.id);
    if (!treino) return res.status(404).json({ error: "Treino não encontrado" });
    
    treino.blocos = selectBlocksByTreino.all(treino.id);
    res.json(treino);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRIAR NOVO TREINO (Transação Atômica)
app.post('/api/treinos', (req, res) => {
  const { nome, duracao_total, blocos } = req.body;

  if (!nome || !blocos?.length) {
    return res.status(400).json({ error: "Dados inválidos: Nome e Blocos são obrigatórios." });
  }

  const createTx = db.transaction((nome, duracao, lista) => {
    const info = insertTreino.run(nome, duracao);
    const id = info.lastInsertRowid;
    for (const b of lista) {
      insertBloco.run(id, b.tempo_inicial, b.tempo_final, b.intensidade, b.exercicio || 'ATIVIDADE', b.rpm || 80);
    }
    return id;
  });

  try {
    const id = createTx(nome, duracao_total, blocos);
    res.status(201).json({ id, message: "Treino criado com sucesso!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ATUALIZAR TREINO EXISTENTE (Replace Sync)
app.put('/api/treinos/:id', (req, res) => {
  const { id } = req.params;
  const { nome, duracao_total, blocos } = req.body;

  if (!nome || !blocos?.length) {
    return res.status(400).json({ error: "Dados incompletos para atualização." });
  }

  const updateTx = db.transaction((tId, tNome, tDuracao, tBlocos) => {
    // 1. Atualiza dados básicos
    const result = updateTreinoBase.run(tNome, tDuracao, tId);
    if (result.changes === 0) throw new Error("Treino não encontrado");

    // 2. Remove blocos antigos (limpa a timeline)
    deleteBlocksByTreino.run(tId);

    // 3. Insere a nova versão da timeline
    for (const b of tBlocos) {
      insertBloco.run(tId, b.tempo_inicial, b.tempo_final, b.intensidade, b.exercicio || 'ATIVIDADE', b.rpm || 80);
    }
  });

  try {
    updateTx(id, nome, duracao_total, blocos);
    res.json({ message: "Treino atualizado com sucesso!" });
  } catch (err) {
    res.status(err.message === "Treino não encontrado" ? 404 : 500).json({ error: err.message });
  }
});

// EXCLUIR TREINO
app.delete('/api/treinos/:id', (req, res) => {
  try {
    const result = deleteTreino.run(req.params.id);
    if (result.changes > 0) {
      res.json({ message: "Treino removido com sucesso!" });
    } else {
      res.status(404).json({ error: "Treino não encontrado" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log('🚀 Backend Telemetria Pro rodando em http://localhost:3001');
});