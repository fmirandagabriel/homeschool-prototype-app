from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import datetime
import uuid
from fpdf import FPDF
import os

# --- Data Models (Pydantic) ---
class Child(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    birthDate: Optional[str] = None
    createdAt: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

class Subject(BaseModel):
    id: str
    name: str
    description: Optional[str] = None

class LearningGoal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    subjectId: str
    description: str
    status: str = "Pendente" # Pendente, Em Progresso, Concluído
    createdAt: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

class LoggedActivity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    activityDate: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    subjectId: str
    description: str
    observations: Optional[str] = None
    relatedGoalId: Optional[str] = None
    createdAt: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

class ReportRequest(BaseModel):
    childId: str
    # startDate: Optional[str] = None # Simplified for prototype
    # endDate: Optional[str] = None   # Simplified for prototype

class AnalysisRequest(BaseModel):
    childId: str

# --- In-Memory Data Store ---
# Simulate a single user for simplicity
SIMULATED_USER_ID = "user123"

db: Dict[str, Dict] = {
    "users": {
        SIMULATED_USER_ID: {"name": "Usuário Exemplo", "email": "exemplo@test.com"}
    },
    "children": {},
    "subjects": {
        "math": Subject(id="math", name="Matemática", description="Números e operações"),
        "hist": Subject(id="hist", name="História", description="Eventos passados"),
        "sci": Subject(id="sci", name="Ciências", description="Natureza e experimentos")
    },
    "goals": {},
    "activities": {}
}

# --- FastAPI App ---
app = FastAPI(title="Homeschooling Platform Prototype API")

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for prototype
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Helper Functions ---
def get_child_data(child_id: str):
    if child_id not in db["children"]:
        raise HTTPException(status_code=404, detail="Criança não encontrada")
    return db["children"][child_id]

def get_child_goals(child_id: str) -> List[LearningGoal]:
    return [goal for goal in db["goals"].get(child_id, {}).values()]

def get_child_activities(child_id: str) -> List[LoggedActivity]:
    return [activity for activity in db["activities"].get(child_id, {}).values()]

# --- API Endpoints ---
@app.get("/api/children", response_model=List[Child])
async def list_children():
    """Lista todas as crianças cadastradas para o usuário simulado."""
    return list(db["children"].values())

@app.post("/api/children", response_model=Child, status_code=201)
async def add_child(child_in: Child = Body(...)):
    """Adiciona uma nova criança."""
    child = Child(**child_in.dict(exclude_unset=True)) # Use default factories
    if child.id in db["children"]:
        raise HTTPException(status_code=400, detail="ID de criança já existe")
    db["children"][child.id] = child
    # Initialize goal and activity lists for the new child
    db["goals"][child.id] = {}
    db["activities"][child.id] = {}
    return child

@app.get("/api/subjects", response_model=List[Subject])
async def list_subjects():
    """Lista as disciplinas pré-definidas."""
    return list(db["subjects"].values())

@app.get("/api/children/{child_id}/goals", response_model=List[LearningGoal])
async def list_goals(child_id: str):
    """Lista as metas de aprendizagem de uma criança específica."""
    get_child_data(child_id) # Check if child exists
    return get_child_goals(child_id)

@app.post("/api/children/{child_id}/goals", response_model=LearningGoal, status_code=201)
async def add_goal(child_id: str, goal_in: LearningGoal = Body(...)):
    """Adiciona uma nova meta de aprendizagem para uma criança."""
    get_child_data(child_id) # Check if child exists
    if goal_in.subjectId not in db["subjects"]:
        raise HTTPException(status_code=400, detail="Disciplina inválida")

    goal = LearningGoal(**goal_in.dict(exclude_unset=True))
    if goal.id in db["goals"].get(child_id, {}):
         raise HTTPException(status_code=400, detail="ID de meta já existe")

    if child_id not in db["goals"]:
        db["goals"][child_id] = {}
    db["goals"][child_id][goal.id] = goal
    return goal

@app.get("/api/children/{child_id}/activities", response_model=List[LoggedActivity])
async def list_activities(child_id: str):
    """Lista as atividades registradas para uma criança específica."""
    get_child_data(child_id) # Check if child exists
    return get_child_activities(child_id)

@app.post("/api/children/{child_id}/activities", response_model=LoggedActivity, status_code=201)
async def log_activity(child_id: str, activity_in: LoggedActivity = Body(...)):
    """Registra uma nova atividade realizada por uma criança."""
    get_child_data(child_id) # Check if child exists
    if activity_in.subjectId not in db["subjects"]:
        raise HTTPException(status_code=400, detail="Disciplina inválida")

    activity = LoggedActivity(**activity_in.dict(exclude_unset=True))
    if activity.id in db["activities"].get(child_id, {}):
        raise HTTPException(status_code=400, detail="ID de atividade já existe")

    if child_id not in db["activities"]:
        db["activities"][child_id] = {}
    db["activities"][child_id][activity.id] = activity
    return activity

@app.post("/api/reports/generate-example")
async def generate_example_report(req: ReportRequest):
    """Gera um relatório PDF de exemplo com atividades recentes."""
    child = get_child_data(req.childId)
    activities = sorted(get_child_activities(req.childId), key=lambda x: x.activityDate, reverse=True)
    goals = get_child_goals(req.childId)
    subjects = db["subjects"]

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=16)
    pdf.cell(200, 10, txt=f"Relatório de Progresso - {child.name}", ln=True, align='C')
    pdf.ln(10)

    pdf.set_font("Helvetica", 'B', size=12)
    pdf.cell(200, 10, txt="Metas de Aprendizagem", ln=True)
    pdf.set_font("Helvetica", size=10)
    if goals:
        for goal in goals:
            subject_name = subjects.get(goal.subjectId, Subject(id='?', name='Desconhecida')).name
            pdf.multi_cell(190, 5, txt=f"- [{subject_name}] {goal.description} (Status: {goal.status})")
    else:
        pdf.cell(200, 10, txt="Nenhuma meta cadastrada.", ln=True)
    pdf.ln(5)

    pdf.set_font("Helvetica", 'B', size=12)
    pdf.cell(200, 10, txt="Atividades Recentes", ln=True)
    pdf.set_font("Helvetica", size=10)
    if activities:
        for activity in activities[:10]: # Limit to 10 recent activities for example
            subject_name = subjects.get(activity.subjectId, Subject(id='?', name='Desconhecida')).name
            date_str = activity.activityDate.strftime('%d/%m/%Y')
            pdf.multi_cell(190, 5, txt=f"- {date_str} [{subject_name}]: {activity.description}")
            if activity.observations:
                pdf.set_font("Helvetica", 'I', size=9)
                pdf.multi_cell(180, 4, txt=f"  Obs: {activity.observations}", align='L')
                pdf.set_font("Helvetica", size=10)
    else:
        pdf.cell(200, 10, txt="Nenhuma atividade registrada.", ln=True)
    pdf.ln(5)

    # Ensure the reports directory exists
    report_dir = "/home/ubuntu/homeschool_prototype/backend/reports"
    os.makedirs(report_dir, exist_ok=True)
    report_path = os.path.join(report_dir, f"report_{req.childId}_{uuid.uuid4()}.pdf")

    try:
        pdf.output(report_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {e}")

    return FileResponse(report_path, media_type='application/pdf', filename=f"relatorio_{child.name}.pdf")

@app.post("/api/ai/analyze-simulated")
async def analyze_progress_simulated(req: AnalysisRequest):
    """Retorna uma análise de IA simulada e pré-definida."""
    child = get_child_data(req.childId)
    # In a real scenario, fetch data and call an AI service
    # Here, we return a fixed response
    analysis = {
        "analysisId": str(uuid.uuid4()),
        "summary": f"Análise simulada para {child.name}. No geral, demonstra bom engajamento nas atividades registradas.",
        "strengths": [
            "Participação ativa nas aulas de História.",
            "Progresso notável em conceitos básicos de Matemática."
        ],
        "areasForAttention": [
            "Pode se beneficiar de mais prática em escrita cursiva.",
            "Explorar diferentes abordagens para os experimentos de Ciências pode aumentar o interesse."
        ],
        "suggestions": [
            "Introduzir jogos educativos para reforçar a tabuada.",
            "Visitar um museu local para complementar os estudos de História.",
            "Realizar um projeto de ciências sobre o ciclo da água."
        ]
    }
    return JSONResponse(content=analysis)

# --- Run (for local testing if needed) ---
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)


