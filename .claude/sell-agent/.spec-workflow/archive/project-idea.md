


desenvolver o backend de um Agente de Vendas via WhatsApp focado em vender supletivo EJA (conclusão do Ensino Médio em 30 dias, ticket de R$ 997).
O público-alvo tem **baixa fluência tecnológica**. O sistema deve ser persuasivo, extremamente rápido, tolerante a falhas e rodar 100% em uma VPS.

## 2. Stack Tecnológica Obrigatória (STRICT)
- **Linguagem:** Python 3.11+
- **API Web:** FastAPI (Assíncrono).
- **Framework de Agentes:** Agno (antigo Phidata). **PROIBIDO usar LangChain ou LangGraph.**
- **Banco de Dados:** Supabase (PostgreSQL) usando `asyncpg` e `pgvector` para RAG.
- **Cache/Idempotência:** Redis.
- **Tarefas em Background/Cron:** `APScheduler` e `BackgroundTasks` nativo do FastAPI.
- **Estruturação de Dados:** `Pydantic`.

## 3. Regras de Arquitetura Core (Não Negociáveis)
1. **Latência Zero no Webhook:** O endpoint `POST /webhook` do WhatsApp DEVE salvar a intenção/mensagem no Redis e retornar `200 OK` instantaneamente. O processamento da IA DEVE rodar em background.
2. **Idempotência Rigorosa:** Sempre verifique o `message_id` da API do WhatsApp no Redis. Se já existir, ignore. Evite respostas duplicadas.
3. **Database Pooling:** Use Pool de Conexões assíncronas para o Supabase (porta 6543) para não estourar conexões.
4. **Tratamento de Exceções:** Implemente Graceful Shutdown e proteja as requisições LLM com try/except e retry automático (Tenacity).

## 4. Arquitetura Multi-Agente (Agno Framework)

O sistema é dividido em **Três Motores Principais**:

### Motor 1: Front-Line (Tempo Real / Webhook)
Implementado usando a classe `Team` do Agno. Foco em conversão rápida.
- **Agente Líder (O Closer):** 
  - **Função:** Fazer o pitch, quebrar objeções na hora acessando o Supabase (`PgKnowledgeBase` via pgvector) e enviar o link de checkout.
  - **Regra:** Nunca mencionar regras complexas sem necessidade. Falar de forma humana, curta e direta.
- **Agente Extrator (Stealth BI):**
  - **Função:** Sub-agente (ou Tool Python) que roda em background. Extrai os dados do usuário (Estado, Escolaridade, Motivo) da conversa natural e salva no banco (CRM) sem fazer perguntas formulário.

### Motor 2: Follow-up Sniper (Assíncrono / APScheduler - A cada 1h)
Motor de recuperação de carrinhos e inativos.
- **Lógica:** Busca leads com `status='Aberto'`, inativos há > 4 horas.
- **Regras de Disparo:** Roda APENAS entre 08h e 20h (Timezone: `America/Sao_Paulo`). Limite de 3 tentativas por lead (após isso, status=`Arquivado`).
- **Prompt Dinâmico:** Lê a `ultima_objecao` no banco e gera uma resposta cirúrgica focada nessa dor (Ex: Prova social se a objeção foi MEC; Escassez se foi Tempo). Proibido mandar "Oi, tudo bem?".

### Motor 3: Cientista de Conversão (Back-Office / Cron Diário)
Agente analítico focado em Sales Ops. Não fala com clientes.
- **Lógica:** Puxa lote de transcrições de leads "Perdidos" ou "Arquivados" no banco.
- **Ação:** Analisa o motivo da perda de forma holística (copy ruim, atrito UX, objeção não mapeada).
- **Output:** Gera um JSON estruturado via `Pydantic` com Insights e sugestões de novos scripts de vendas.
- **Tools Integradas:** Salva novos argumentos no banco com status `RASCUNHO` (aguardando aprovação humana) e envia um alerta resumido para o Admin.

## 5. Estrutura do Banco de Dados (Supabase)
Espera-se que o código crie/interaja com a seguinte estrutura lógica:
- `leads`: (id, telefone, nome, estado, motivo, escolaridade, status_funil, ultima_interacao, ultima_objecao, follow_ups_enviados).
- `chats`: Memória do Agno (`PgAgentStorage`).
- `knowledge_base`: Base vetorial RAG (`PgKnowledgeBase` - texto, embedding, status [APROVADO/RASCUNHO]).

## 6. Fluxograma Visual (Para Contexto da IA)

```mermaid
graph TD
    WH[FastAPI POST /webhook] -->|200 OK imediato| Cache[(Redis: Idempotência)]
    Cache --> BTask(BackgroundTasks)
    
    subgraph 1. Front-Line (Agno)
        BTask --> Team[Agno Team: Líder + Extrator]
        Team <-->|Consulta Objeções| RAG[(Supabase: PgVector)]
        Team -->|Salva BI| CRM[(Supabase: Leads)]
    end
    
    subgraph 2. Motor Follow-up (APScheduler)
        Cron1[Cron: 1 em 1 hora] --> Busca[Busca inativos > 4h]
        Busca --> Sniper[Agno Agent: Sniper]
        Sniper -->|Dispara Proposta baseada na dor| WAPI(WhatsApp API)
    end
    
    subgraph 3. Cientista de Conversão
        Cron2[Cron: Diário] --> Analise[Agente Analista]
        Analise <-->|Lê perdidos| CRM
        Analise -->|Grava Sugestões| RAG
    end
7. Instruções de Inicialização para a IA (Primeiro Passo)
Analise este documento e me confirme o entendimento das 3 frentes de agentes.

Crie a estrutura de diretórios do projeto Python (ex: app/api, app/agents, app/core, app/jobs).

Escreva o requirements.txt com as dependências essenciais (fastapi, agno, asyncpg, redis, apscheduler, pydantic).

Aguarde minha confirmação para começar a gerar o código do main.py e configuração do Supabase.


flowchart TD
    %% Estilos Visuais
    classDef client fill:#e0f2fe,stroke:#2563eb,stroke-width:2px;
    classDef api fill:#fef08a,stroke:#d97706,stroke-width:2px;
    classDef core fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef agent fill:#f3e8ff,stroke:#9333ea,stroke-width:2px;
    classDef db fill:#fce7f3,stroke:#c026d3,stroke-width:2px;
    classDef cron fill:#ffedd5,stroke:#e11d48,stroke-width:2px;

    User(("🧑‍💻 Lead no WhatsApp")):::client
    WAPI["🔌 API WhatsApp / Evolution"]:::api

    User <-->|"Mensagens"| WAPI

    subgraph Servidor_VPS["🖥️ VPS - Backend Python / FastAPI"]
        
        %% Motor 1: Tempo Real
        subgraph Motor_FrontLine["⚡ Motor 1: Vendas Ativas Tempo Real"]
            Webhook["FastAPI POST /webhook"]:::core
            Redis[/"🛢️ Cache Redis"\]:::core
            BTask["⚙️ BackgroundTasks"]:::core

            Webhook -->|"1. Valida Idempotência"| Redis
            Redis -- "Novo ID" --> BTask
            Webhook -.->|"2. Retorna 200 OK imediato"| WAPI
            
            subgraph Agno_Team["🤖 Equipe Agno - FrontLine"]
                Lider["👔 Agente Líder / Closer"]:::agent
                Extrator["🕵️‍♂️ Tool: Extrator Stealth BI"]:::agent
                Lider -->|"Se detectar dados"| Extrator
            end
            
            BTask -->|"3. Executa Agente"| Lider
            Lider -->|"6. Envia Pitch/Checkout"| WAPI
        end

        %% Motor 2: Recuperação Assíncrona
        subgraph Motor_Sniper["🎯 Motor 2: Follow-up Sniper"]
            Cron1(("⏰ APScheduler<br>A cada 1h")):::cron
            ValidaRegra{"Dentro das<br>08h - 20h?"}:::cron
            BuscaInativos["🔎 Busca Leads inativos > 4h<br>com Follow-up < 3"]:::cron
            AgenteSniper["🎯 Agente Sniper Agno"]:::agent
            
            Cron1 --> ValidaRegra
            ValidaRegra -->|"Sim"| BuscaInativos
            BuscaInativos -->|"Envia última objeção"| AgenteSniper
            AgenteSniper -->|"Gera Copy Personalizada"| WAPI
        end

        %% Motor 3: Cientista de Conversão
        subgraph Motor_Growth["🧠 Motor 3: Cientista Comercial"]
            Cron2(("🌙 APScheduler<br>Diário 23h")):::cron
            BuscaPerdidos["📉 Extrai Lote de Leads<br>Arquivados/Perdidos"]:::cron
            AgenteCientista["🧪 Agente Analista Agno"]:::agent
            FormataJSON["📋 Pydantic JSON Builder"]:::agent
            
            Cron2 --> BuscaPerdidos
            BuscaPerdidos --> AgenteCientista
            AgenteCientista -->|"Gera Insights de Copy/UX"| FormataJSON
            FormataJSON -->|"Notifica"| AlertaAdmin["📱 Disparo WhatsApp Admin"]:::core
        end
    end

    %% Banco de Dados Central
    subgraph Supabase_Cloud["☁️ Supabase PostgreSQL"]
        CRM[/"👥 Leads<br>Status, Objeções, CRM"\]:::db
        Hist[/"💬 Chats<br>PgAgentStorage"\]:::db
        RAG[/"🧠 PgKnowledgeBase<br>PgVector RAG"\]:::db
    end

    %% Conexões de Dados - Motor 1
    Lider <-->|"4. Lê/Atualiza Histórico"| Hist
    Lider <-->|"5. Consulta Regras MEC/Provas"| RAG
    Extrator -->|"Update Oculto de BI"| CRM

    %% Conexões de Dados - Motor 2
    BuscaInativos <-->|"Lê ultima_objecao"| CRM
    AgenteSniper -->|"Incrementa followups_enviados"| CRM

    %% Conexões de Dados - Motor 3
    BuscaPerdidos <-->|"Baixa Transcrições"| Hist
    FormataJSON -->|"Salva sugestões como RASCUNHO"| RAG


