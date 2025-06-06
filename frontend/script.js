const API_BASE_URL = 'https://homeschool-backend-7iou.onrender.com'; // Adjust if your backend runs elsewhere

// --- DOM Elements ---
const addChildForm = document.getElementById('add-child-form');
const childNameInput = document.getElementById('child-name');
const childBirthdateInput = document.getElementById('child-birthdate');
const childSelect = document.getElementById('child-select');
const childrenListDiv = document.getElementById('children-list');

const detailsSection = document.getElementById('details-section');
const selectedChildNameH2 = document.getElementById('selected-child-name');

const addGoalForm = document.getElementById('add-goal-form');
const goalSubjectSelect = document.getElementById('goal-subject');
const goalDescriptionInput = document.getElementById('goal-description');
const goalsListUl = document.getElementById('goals-list');

const logActivityForm = document.getElementById('log-activity-form');
const activitySubjectSelect = document.getElementById('activity-subject');
const activityDescriptionInput = document.getElementById('activity-description');
const activityObservationsTextarea = document.getElementById('activity-observations');
const activitiesListUl = document.getElementById('activities-list');

const generateReportBtn = document.getElementById('generate-report-btn');
const reportStatusP = document.getElementById('report-status');

const analyzeProgressBtn = document.getElementById('analyze-progress-btn');
const aiAnalysisResultDiv = document.getElementById('ai-analysis-result');

// --- State ---
let currentChildId = null;
let subjects = [];
let children = [];

// --- API Helper ---
async function fetchApi(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.detail}`);
        }
        // Handle PDF response separately
        if (response.headers.get('content-type')?.includes('application/pdf')) {
            return response; // Return the whole response for PDF to get headers
        }
        // Handle empty response (e.g., 204 No Content)
        if (response.status === 204) {
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error('API Fetch Error:', error);
        alert(`Erro na comunicação com a API: ${error.message}`);
        throw error; // Re-throw to handle in specific callers if needed
    }
}

// --- UI Update Functions ---
function populateSubjectsDropdowns(subjectsData) {
    subjects = subjectsData;
    goalSubjectSelect.innerHTML = '<option value="" disabled selected>Selecione a Disciplina</option>';
    activitySubjectSelect.innerHTML = '<option value="" disabled selected>Selecione a Disciplina</option>';
    subjects.forEach(subject => {
        const optionGoal = document.createElement('option');
        optionGoal.value = subject.id;
        optionGoal.textContent = subject.name;
        goalSubjectSelect.appendChild(optionGoal);

        const optionActivity = document.createElement('option');
        optionActivity.value = subject.id;
        optionActivity.textContent = subject.name;
        activitySubjectSelect.appendChild(optionActivity);
    });
}

function populateChildrenList(childrenData) {
    children = childrenData;
    childSelect.innerHTML = ''; // Clear existing options
    if (children.length === 0) {
        const option = document.createElement('option');
        option.textContent = "Nenhuma criança cadastrada";
        option.disabled = true;
        childSelect.appendChild(option);
    } else {
        children.forEach(child => {
            const option = document.createElement('option');
            option.value = child.id;
            option.textContent = child.name;
            childSelect.appendChild(option);
        });
    }
}

function displayGoals(goalsData) {
    goalsListUl.innerHTML = '';
    if (goalsData.length === 0) {
        goalsListUl.innerHTML = '<li>Nenhuma meta cadastrada para esta criança.</li>';
        return;
    }
    goalsData.forEach(goal => {
        const li = document.createElement('li');
        const subjectName = subjects.find(s => s.id === goal.subjectId)?.name || 'Desconhecida';
        li.innerHTML = `<span>[${subjectName}]</span> ${goal.description} <i>(Status: ${goal.status})</i>`;
        goalsListUl.appendChild(li);
    });
}

function displayActivities(activitiesData) {
    activitiesListUl.innerHTML = '';
    if (activitiesData.length === 0) {
        activitiesListUl.innerHTML = '<li>Nenhuma atividade registrada para esta criança.</li>';
        return;
    }
    activitiesData.sort((a, b) => new Date(b.activityDate) - new Date(a.activityDate));
    activitiesData.forEach(activity => {
        const li = document.createElement('li');
        const subjectName = subjects.find(s => s.id === activity.subjectId)?.name || 'Desconhecida';
        const dateStr = new Date(activity.activityDate).toLocaleDateString('pt-BR');
        li.innerHTML = `
            <strong>${dateStr} - [${subjectName}]</strong>: ${activity.description}
            ${activity.observations ? `<br><small><i>Obs: ${activity.observations}</i></small>` : ''}
        `;
        activitiesListUl.appendChild(li);
    });
}

// --- Event Handlers ---
async function handleAddChild(event) {
    event.preventDefault();
    const name = childNameInput.value.trim();
    const birthDate = childBirthdateInput.value;
    if (!name) return;

    try {
        const newChild = await fetchApi('/api/children', {
            method: 'POST',
            body: JSON.stringify({ name: name, birthDate: birthDate || null })
        });
        children.push(newChild);
        populateChildrenList(children);
        addChildForm.reset();
        childSelect.value = newChild.id;
        handleChildSelection();
    } catch (error) { /* Handled by fetchApi */ }
}

async function handleChildSelection() {
    currentChildId = childSelect.value;
    if (!currentChildId) {
        detailsSection.style.display = 'none';
        return;
    }

    const selectedChild = children.find(c => c.id === currentChildId);
    selectedChildNameH2.textContent = `Detalhes de ${selectedChild.name}`;
    detailsSection.style.display = 'block';

    addGoalForm.reset();
    logActivityForm.reset();
    goalsListUl.innerHTML = '<li>Carregando metas...</li>';
    activitiesListUl.innerHTML = '<li>Carregando atividades...</li>';
    reportStatusP.textContent = '';
    aiAnalysisResultDiv.innerHTML = ''; // Clear previous analysis
    openTab(null, 'goals');
    document.querySelectorAll('.tab-button').forEach((btn, index) => {
        btn.classList.toggle('active', index === 0);
    });

    try {
        const [goals, activities] = await Promise.all([
            fetchApi(`/api/children/${currentChildId}/goals`),
            fetchApi(`/api/children/${currentChildId}/activities`)
        ]);
        displayGoals(goals);
        displayActivities(activities);
    } catch (error) {
        goalsListUl.innerHTML = '<li>Erro ao carregar metas.</li>';
        activitiesListUl.innerHTML = '<li>Erro ao carregar atividades.</li>';
    }
}

async function handleAddGoal(event) {
    event.preventDefault();
    if (!currentChildId) return;
    const subjectId = goalSubjectSelect.value;
    const description = goalDescriptionInput.value.trim();
    if (!subjectId || !description) {
        alert('Por favor, selecione a disciplina e descreva a meta.');
        return;
    }
    try {
        await fetchApi(`/api/children/${currentChildId}/goals`, {
            method: 'POST',
            body: JSON.stringify({ subjectId, description })
        });
        const goals = await fetchApi(`/api/children/${currentChildId}/goals`);
        displayGoals(goals);
        addGoalForm.reset();
    } catch (error) { /* Handled by fetchApi */ }
}

async function handleLogActivity(event) {
    event.preventDefault();
    if (!currentChildId) return;
    const subjectId = activitySubjectSelect.value;
    const description = activityDescriptionInput.value.trim();
    const observations = activityObservationsTextarea.value.trim();
    if (!subjectId || !description) {
        alert('Por favor, selecione a disciplina e descreva a atividade.');
        return;
    }
    try {
        await fetchApi(`/api/children/${currentChildId}/activities`, {
            method: 'POST',
            body: JSON.stringify({ subjectId, description, observations: observations || null })
        });
        const activities = await fetchApi(`/api/children/${currentChildId}/activities`);
        displayActivities(activities);
        logActivityForm.reset();
    } catch (error) { /* Handled by fetchApi */ }
}

async function handleGenerateReport() {
    if (!currentChildId) {
        alert("Selecione uma criança primeiro.");
        return;
    }
    reportStatusP.textContent = 'Gerando relatório...';
    generateReportBtn.disabled = true;

    try {
        const response = await fetchApi('/api/reports/generate-example', {
            method: 'POST',
            body: JSON.stringify({ childId: currentChildId })
        });

        const blob = await response.blob();

        const contentDisposition = response.headers.get('content-disposition');
        let filename = `relatorio_${children.find(c=>c.id === currentChildId)?.name || currentChildId}.pdf`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/i);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1];
            }
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        reportStatusP.textContent = 'Relatório gerado e download iniciado!';
        setTimeout(() => { reportStatusP.textContent = ''; }, 5000);

    } catch (error) {
        reportStatusP.textContent = 'Erro ao gerar relatório.';
    } finally {
        generateReportBtn.disabled = false;
    }
}

async function handleAnalyzeProgress() {
    if (!currentChildId) {
        alert("Selecione uma criança primeiro.");
        return;
    }
    aiAnalysisResultDiv.innerHTML = '<i>Analisando progresso...</i>';
    analyzeProgressBtn.disabled = true;

    try {
        const analysis = await fetchApi('/api/ai/analyze-simulated', {
            method: 'POST',
            body: JSON.stringify({ childId: currentChildId })
        });

        // Format the analysis for display
        let htmlResult = `<h4>Resumo da Análise (ID: ${analysis.analysisId})</h4>`;
        htmlResult += `<p>${analysis.summary}</p>`;

        if (analysis.strengths && analysis.strengths.length > 0) {
            htmlResult += `<h5>Pontos Fortes:</h5><ul>`;
            analysis.strengths.forEach(item => { htmlResult += `<li>${item}</li>`; });
            htmlResult += `</ul>`;
        }

        if (analysis.areasForAttention && analysis.areasForAttention.length > 0) {
            htmlResult += `<h5>Áreas para Atenção:</h5><ul>`;
            analysis.areasForAttention.forEach(item => { htmlResult += `<li>${item}</li>`; });
            htmlResult += `</ul>`;
        }

        if (analysis.suggestions && analysis.suggestions.length > 0) {
            htmlResult += `<h5>Sugestões:</h5><ul>`;
            analysis.suggestions.forEach(item => { htmlResult += `<li>${item}</li>`; });
            htmlResult += `</ul>`;
        }

        aiAnalysisResultDiv.innerHTML = htmlResult;

    } catch (error) {
        aiAnalysisResultDiv.innerHTML = '<p style="color: red;">Erro ao obter análise.</p>';
    } finally {
        analyzeProgressBtn.disabled = false;
    }
}

// --- Tab Navigation ---
function openTab(evt, tabName) {
    const tabcontent = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    const tabbuttons = document.getElementsByClassName("tab-button");
    for (let i = 0; i < tabbuttons.length; i++) {
        tabbuttons[i].className = tabbuttons[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    if (evt) {
        evt.currentTarget.className += " active";
    }
}

// --- Initialization ---
async function initializeApp() {
    try {
        const [childrenData, subjectsData] = await Promise.all([
            fetchApi('/api/children'),
            fetchApi('/api/subjects')
        ]);
        populateChildrenList(childrenData);
        populateSubjectsDropdowns(subjectsData);
    } catch (error) {
        childrenListDiv.innerHTML = '<p style="color: red;">Erro ao carregar dados iniciais.</p>';
    }

    // Add event listeners
    addChildForm.addEventListener('submit', handleAddChild);
    childSelect.addEventListener('change', handleChildSelection);
    addGoalForm.addEventListener('submit', handleAddGoal);
    logActivityForm.addEventListener('submit', handleLogActivity);
    generateReportBtn.addEventListener('click', handleGenerateReport);
    analyzeProgressBtn.addEventListener('click', handleAnalyzeProgress); // Added listener

    const firstTabButton = document.querySelector('.tabs .tab-button');
    if (firstTabButton) firstTabButton.classList.add('active');
    const firstTabContent = document.querySelector('.tab-content');
    if (firstTabContent) firstTabContent.style.display = 'block';
}

// --- Start the app ---
document.addEventListener('DOMContentLoaded', initializeApp);
