// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB0aHMzbNulcVDlQTko05V07zt4coDkiAk",
  authDomain: "diagrama-cerrado.firebaseapp.com",
  projectId: "diagrama-cerrado",
  storageBucket: "diagrama-cerrado.firebasestorage.app",
  messagingSenderId: "883346146848",
  appId: "1:883346146848:web:6ff5689ef5172fc5885e45",
  measurementId: "G-PK7V0Y7HXZ"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Referências das coleções
const questionsRef = db.collection('questions');
const empresasRef = db.collection('empresas');
const criteriosHistoricoRef = db.collection('criterios_historico');

let currentEmpresaId = null; // Para controlar qual empresa está sendo editada

// Lista padrão de critérios
const defaultQuestions = [
  "A dívida líquida da empresa é menor que o lucro líquido dos últimos 12 meses?",
  "ROE historicamente maior que 5%?",
  "Tem crescimento de receitas/lucros superior a 5% nos últimos 5 anos?",
  "A empresa tem um histórico de pagamento de dividendos?",
  "A empresa investe amplamente em pesquisa e inovação?",
  "A empresa está negociada com P/VP abaixo de 5?",
  "A empresa teve lucro operacional no último exercício?",
  "Tem mais de 30 anos de mercado?",
  "É líder no setor em que atua?"
];

// CARREGA OS CRITÉRIOS
async function carregarPerguntas() {
  try {
    const snapshot = await questionsRef.get();
    if (snapshot.empty) {
      console.log("Nenhum critério encontrado. Criando estrutura inicial...");
      // Cria documento inicial com as perguntas padrão
      const questionsWithDefaults = defaultQuestions.map(text => ({
        text,
        checked: false
      }));
      
      await questionsRef.add({
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        questions: questionsWithDefaults
      });

      // Adiciona as perguntas padrão ao DOM
      defaultQuestions.forEach(q => {
        addQuestionToDOM(q, false);
      });
    } else {
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.questions && data.questions.length > 0) {
          data.questions.forEach(q => {
            addQuestionToDOM(q.text, q.checked);
          });
        } else {
          // Se não houver perguntas salvas, adiciona as padrão
          defaultQuestions.forEach(q => {
            addQuestionToDOM(q, false);
          });
        }
      });
    }
  } catch (error) {
    console.error("Erro ao carregar perguntas:", error);
  }
}

// ADICIONA UM CRITÉRIO NO DOM
function addQuestionToDOM(text, checked) {
  const questionList = document.getElementById('question-list');
  const divRow = document.createElement('div');
  divRow.className = 'question-row';
  
  // Primeiro criamos todos os elementos
  const label = document.createElement('span');
  label.className = 'question-label';
  label.contentEditable = true;
  label.textContent = text;

  const switchLabel = document.createElement('label');
  switchLabel.className = 'switch';
  switchLabel.innerHTML = `
    <input type="checkbox" ${checked ? 'checked' : ''}>
    <span class="slider"></span>
  `;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.textContent = 'Remover';

  // Adicionamos todos os elementos à divRow
  divRow.appendChild(label);
  divRow.appendChild(switchLabel);
  divRow.appendChild(removeBtn);

  let originalText = text;
  
  // Evento para o Enter
  label.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      label.blur();
    }
  });
  
  // Quando terminar a edição
  label.addEventListener('blur', () => {
    if (currentEmpresaId) {
      atualizarEmpresaAtual();
    } else {
      saveQuestions();
    }
  });
  
  // Checkbox change
  divRow.querySelector('input[type="checkbox"]').addEventListener('change', () => {
    calcularPontuacao();
    if (currentEmpresaId) {
      atualizarEmpresaAtual();
    } else {
      saveQuestions();
    }
  });
  
  // Remove button
  removeBtn.addEventListener('click', () => {
    divRow.remove();
    calcularPontuacao();
    if (currentEmpresaId) {
      atualizarEmpresaAtual();
    } else {
      saveQuestions();
    }
  });
  
  questionList.appendChild(divRow);
  calcularPontuacao();
}

// SALVA OS CRITÉRIOS NO FIRESTORE
async function saveQuestions() {
  const questionRows = document.querySelectorAll('.question-row');
  const questions = [];
  questionRows.forEach(row => {
    const text = row.querySelector('.question-label').innerText.trim();
    const checked = row.querySelector('input[type="checkbox"]').checked;
    questions.push({ 
      text, 
      checked
    });
  });
  
  try {
    const snapshot = await questionsRef.limit(1).get();
    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({ 
        questions,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await questionsRef.add({ 
        questions,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    console.log("Critérios salvos com sucesso!");
  } catch (error) {
    console.error("Erro ao salvar critérios:", error);
    alert("Erro ao salvar critérios. Tente novamente.");
  }
}

// CALCULA A PONTUAÇÃO E ATUALIZA O SCOREBOARD
function calcularPontuacao() {
  const checkboxes = document.querySelectorAll('#question-list input[type="checkbox"]');
  let pontosPositivos = 0;
  let pontosNegativos = 0;
  checkboxes.forEach(checkbox => {
    if (checkbox.checked) {
      pontosPositivos++;
    } else {
      pontosNegativos++;
    }
  });
  const pontuacaoFinal = pontosPositivos - pontosNegativos;
  document.getElementById('pontosPositivos').innerText = pontosPositivos;
  document.getElementById('pontosNegativos').innerText = pontosNegativos;
  document.getElementById('pontuacaoFinal').innerText = pontuacaoFinal;
}

// ADICIONA UMA NOVA PERGUNTA
function adicionarNovaPergunta() {
  const questionList = document.getElementById('question-list');
  const count = questionList.children.length + 1;
  const text = `Critério ${count}`;
  addQuestionToDOM(text, false);
  saveQuestions(); // Salva automaticamente ao adicionar
}

// INICIALIZAÇÃO E EVENT LISTENERS
window.addEventListener('load', () => {
  carregarPerguntas();
  subscribeEmpresas();
  
  // Adiciona os event listeners aos botões
  document.getElementById('btnAddQuestion').addEventListener('click', adicionarNovaPergunta);
  document.getElementById('btnAddEmpresa').addEventListener('click', adicionarEmpresaNaTabela);
});

// SUBSCREVE A TABELA DE EMPRESAS (EM TEMPO REAL)
function subscribeEmpresas() {
  empresasRef.onSnapshot(snapshot => {
    const empresasTable = document.querySelector('#empresas-table tbody');
    empresasTable.innerHTML = '';
    
    snapshot.forEach(doc => {
      const data = doc.data();
      criarLinhaEmpresa(
        doc.id,
        data.ativo,
        data.resistencia || '0%',
        data.recomendado || '0%'
      );
    });
    
    recalcRecomendados();
  }, error => {
    console.error("Erro ao observar empresas:", error);
  });
}

// CRIA UMA LINHA NA TABELA DE EMPRESAS
function criarLinhaEmpresa(id, ativo, resistencia, recomendado) {
  const tr = document.createElement('tr');
  tr.setAttribute('data-id', id);
  tr.innerHTML = `
    <td>${ativo}</td>
    <td>${resistencia}</td>
    <td>${recomendado}</td>
    <td>
      <button class="edit-btn" onclick="editarEmpresa('${id}')">Editar</button>
      <button class="remove-btn" onclick="removerEmpresa('${id}')">Remover</button>
    </td>
  `;
  document.querySelector('#empresas-table tbody').appendChild(tr);
}

// ADICIONA UMA NOVA EMPRESA COM BASE NA PONTUAÇÃO FINAL
async function adicionarEmpresaNaTabela() {
  const ativoInput = document.getElementById('nomeAtivo');
  const ativo = ativoInput.value.trim();
  
  if (!ativo) {
    alert('Por favor, digite o nome do ativo.');
    return;
  }
  
  try {
    // Coleta os critérios atuais
    const criterios = [];
    document.querySelectorAll('.question-row').forEach(row => {
      criterios.push({
        text: row.querySelector('.question-label').innerText.trim(),
        checked: row.querySelector('input[type="checkbox"]').checked
      });
    });
    
    const resistencia = calcularResistencia();
    
    // Se estiver editando, atualiza a empresa existente
    if (currentEmpresaId) {
      await atualizarEmpresaAtual();
    } else {
      // Cria nova empresa
      const empresaRef = await empresasRef.add({
        ativo,
        resistencia,
        recomendado: '0%',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Salva os critérios
      await atualizarCriteriosEmpresa(empresaRef.id, criterios);
    }
    
    // Limpa o formulário
    ativoInput.value = '';
    currentEmpresaId = null;
    
    // Reseta todos os toggles para desligado
    document.querySelectorAll('.question-row input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = false;
    });
    
    // Recalcula a pontuação após resetar os toggles
    calcularPontuacao();
    
    // Recalcula recomendados
    recalcRecomendados();
    
  } catch (error) {
    console.error('Erro ao salvar empresa:', error);
    alert('Erro ao salvar empresa. Tente novamente.');
  }
}

// Função para calcular a resistência baseada nos critérios marcados
function calcularResistencia() {
  const checkboxes = document.querySelectorAll('.question-row input[type="checkbox"]');
  let total = checkboxes.length;
  let marcados = Array.from(checkboxes).filter(cb => cb.checked).length;
  return total > 0 ? ((marcados / total) * 100).toFixed(1) + '%' : '0%';
}

// RECALCULA OS PERCENTUAIS RECOMENDADOS
async function recalcRecomendados() {
  try {
    const snapshot = await empresasRef.get();
    const empresas = [];
    let totalPeso = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const resistencia = parseFloat(data.resistencia) || 0;
      const peso = resistencia < 1 ? 0.8 : resistencia;
      empresas.push({ id: doc.id, peso });
      totalPeso += peso;
    });
    
    const batch = db.batch();
    
    empresas.forEach(empresa => {
      const recomendado = totalPeso > 0 ? ((empresa.peso / totalPeso) * 100).toFixed(1) + '%' : '0%';
      batch.update(empresasRef.doc(empresa.id), { recomendado });
    });
    
    await batch.commit();
    
    // Atualiza o total recomendado
    const total = empresas.reduce((acc, emp) => acc + (emp.peso / totalPeso) * 100, 0);
    document.getElementById('totalRecomendado').innerText = total.toFixed(1);
    
  } catch (error) {
    console.error('Erro ao recalcular recomendados:', error);
  }
}

// Função para atualizar critérios de uma empresa
async function atualizarCriteriosEmpresa(empresaId, criterios) {
  // Remove critérios antigos
  const criteriosAntigos = await criteriosHistoricoRef
    .where('empresaId', '==', empresaId)
    .get();
  
  const batch = db.batch();
  
  criteriosAntigos.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  // Adiciona novos critérios
  criterios.forEach(criterio => {
    const criterioRef = criteriosHistoricoRef.doc();
    batch.set(criterioRef, {
      empresaId,
      ...criterio,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  
  await batch.commit();
}

// EDITAR EMPRESA
async function editarEmpresa(empresaId) {
  currentEmpresaId = empresaId;
  
  // Busca os dados da empresa
  const empresaDoc = await empresasRef.doc(empresaId).get();
  if (!empresaDoc.exists) return;
  
  const empresaData = empresaDoc.data();
  
  // Limpa a lista atual de critérios
  const questionList = document.getElementById('question-list');
  questionList.innerHTML = '';
  
  // Atualiza o nome do ativo no input e adiciona botões de salvar/cancelar
  const ativoInput = document.getElementById('nomeAtivo');
  const buttonsContainer = document.querySelector('.questions-container');
  
  // Guarda o valor original do ativo
  const originalAtivo = empresaData.ativo;
  ativoInput.value = originalAtivo;
  
  // Cria um container para os botões se não existir
  let actionButtonsContainer = document.querySelector('.action-buttons-container');
  if (!actionButtonsContainer) {
    actionButtonsContainer = document.createElement('div');
    actionButtonsContainer.className = 'action-buttons-container';
    actionButtonsContainer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    `;
    buttonsContainer.after(actionButtonsContainer);
  }
  
  // Cria botões de salvar e cancelar se não existirem
  let saveBtn = actionButtonsContainer.querySelector('.save-edit-btn');
  let cancelBtn = actionButtonsContainer.querySelector('.cancel-edit-btn');
  
  if (!saveBtn) {
    saveBtn = document.createElement('button');
    saveBtn.className = 'save-edit-btn';
    saveBtn.textContent = 'Salvar Edição';
    saveBtn.style.cssText = `
      background: #2ecc71;
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      margin-left: 10px;
    `;
    actionButtonsContainer.appendChild(saveBtn);
  }
  saveBtn.style.display = 'inline-block';
  
  if (!cancelBtn) {
    cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-edit-btn';
    cancelBtn.textContent = 'Cancelar Edição';
    cancelBtn.style.cssText = `
      background: #e74c3c;
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      margin-left: 10px;
    `;
    actionButtonsContainer.appendChild(cancelBtn);
  }
  cancelBtn.style.display = 'inline-block';
  
  // Atualiza os eventos dos botões
  saveBtn.onclick = async () => {
    await atualizarEmpresaAtual();
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    currentEmpresaId = null;
    ativoInput.value = '';
    
    // Reseta todos os toggles para desligado
    document.querySelectorAll('.question-row input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = false;
    });
    
    // Recalcula a pontuação após resetar os toggles
    calcularPontuacao();
  };
  
  cancelBtn.onclick = async () => {
    // Limpa o campo do ativo
    document.getElementById('nomeAtivo').value = '';
    
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    currentEmpresaId = null;
    
    // Limpa a lista atual de critérios
    const questionList = document.getElementById('question-list');
    questionList.innerHTML = '';
    
    // Recarrega os critérios originais com todos os toggles desligados
    try {
      const snapshot = await questionsRef.limit(1).get();
      if (!snapshot.empty) {
        const questions = snapshot.docs[0].data().questions || [];
        questions.forEach(q => {
          addQuestionToDOM(q.text, false); // Force checked to false
        });
      } else {
        // Se não houver critérios salvos, carrega os padrão
        defaultQuestions.forEach(q => {
          addQuestionToDOM(q, false);
        });
      }
      
      // Recalcula a pontuação após resetar os toggles
      calcularPontuacao();
    } catch (error) {
      console.error('Erro ao recarregar critérios:', error);
    }
  };
  
  try {
    // Recupera os critérios específicos desta empresa
    const criteriosSnapshot = await criteriosHistoricoRef
      .where('empresaId', '==', empresaId)
      .get();
    
    // Cria um Map para controlar critérios únicos
    const criteriosUnicos = new Map();
    
    // Recupera os critérios atuais primeiro
    const currentQuestions = await questionsRef.limit(1).get();
    if (!currentQuestions.empty) {
      const questions = currentQuestions.docs[0].data().questions || [];
      questions.forEach(q => {
        criteriosUnicos.set(q.text, { text: q.text, checked: false });
      });
    }
    
    // Atualiza o estado dos critérios com os dados salvos da empresa
    criteriosSnapshot.forEach(doc => {
      const data = doc.data();
      if (criteriosUnicos.has(data.text)) {
        criteriosUnicos.get(data.text).checked = data.checked;
      } else {
        criteriosUnicos.set(data.text, { text: data.text, checked: data.checked });
      }
    });
    
    // Adiciona os critérios ao DOM na ordem correta
    criteriosUnicos.forEach(criterio => {
      addQuestionToDOM(criterio.text, criterio.checked);
    });
    
    // Rola a página para os critérios
    document.querySelector('.analysis-section').scrollIntoView({ behavior: 'smooth' });
    
  } catch (error) {
    console.error('Erro ao carregar critérios:', error);
    alert('Erro ao carregar critérios. Tente novamente.');
  }
}

// REMOVER EMPRESA
async function removerEmpresa(empresaId) {
  if (!confirm('Tem certeza que deseja remover esta empresa?')) return;
  
  try {
    // Remove a empresa
    await empresasRef.doc(empresaId).delete();
    
    // Remove os critérios históricos
    const criteriosSnapshot = await criteriosHistoricoRef
      .where('empresaId', '==', empresaId)
      .get();
    
    const batch = db.batch();
    
    criteriosSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    console.log('Empresa removida com sucesso!');
  } catch (error) {
    console.error('Erro ao remover empresa:', error);
    alert('Erro ao remover empresa. Tente novamente.');
  }
}

// Função para atualizar a empresa atual quando editando
async function atualizarEmpresaAtual() {
  if (!currentEmpresaId) return;
  
  try {
    // Coleta os critérios atuais
    const criterios = [];
    document.querySelectorAll('.question-row').forEach(row => {
      criterios.push({
        text: row.querySelector('.question-label').innerText.trim(),
        checked: row.querySelector('input[type="checkbox"]').checked
      });
    });
    
    // Atualiza a empresa
    await empresasRef.doc(currentEmpresaId).update({
      ativo: document.getElementById('nomeAtivo').value.trim(),
      resistencia: calcularResistencia(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Atualiza os critérios
    await atualizarCriteriosEmpresa(currentEmpresaId, criterios);
    
    // Recalcula recomendados
    await recalcRecomendados();
    
    console.log('Empresa atualizada com sucesso!');
  } catch (error) {
    console.error('Erro ao atualizar empresa:', error);
    alert('Erro ao atualizar empresa. Tente novamente.');
  }
} 