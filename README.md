# 🎙️ Voice Desk — Salon AI

> AI-powered voice and text front-desk assistant for salons, built with NestJS, Groq, RAG, Deepgram, PostgreSQL, and Prisma.

## 🚀 Overview

Voice Desk is an intelligent AI receptionist that handles customer queries through **voice and text**. It uses **Retrieval-Augmented Generation (RAG)** to retrieve relevant information from a salon knowledge base and combines it with **Groq LLMs** to generate accurate, context-aware responses.

The system also supports real-time speech-to-text using **Deepgram**, persistent data storage with **PostgreSQL and Prisma**, automated emails through **Resend**, API documentation with **Swagger**, and application monitoring with **Sentry**.

## ✨ Features

* 🤖 AI-powered conversational support
* 🧠 RAG-based knowledge retrieval
* 🎙️ Voice-to-text using Deepgram
* 📚 Custom salon knowledge base
* 🗄️ PostgreSQL + Prisma
* 📧 Automated emails with Resend
* 📖 Interactive Swagger API documentation
* 🛡️ Sentry error monitoring
* 💬 Voice and text interaction support

## 🔄 How It Works

```text
User
 ↓
Voice / Text Query
 ↓
Deepgram Speech-to-Text
 ↓
RAG Knowledge Retrieval
 ↓
Groq LLM
 ↓
Grounded AI Response
 ↓
PostgreSQL + Prisma
 ↓
Optional Email via Resend
```

For voice requests, Deepgram first converts the user's speech into text. The query is then processed through the RAG pipeline, which retrieves relevant information from the knowledge base. Groq generates the final response using the retrieved context.

## 🛠️ Tech Stack

* **Backend:** NestJS, TypeScript
* **LLM:** Groq API
* **Embeddings:** OpenAI
* **Speech-to-Text:** Deepgram
* **Database:** PostgreSQL
* **ORM:** Prisma
* **Vector Search:** pgvector
* **Email:** Resend
* **API Documentation:** Swagger
* **Monitoring:** Sentry

## 📁 Project Structure

```text
src/
├── chat/              # AI chat functionality
├── deepgram/          # Speech-to-text integration
├── email/             # Email services
├── rag/               # RAG and knowledge retrieval
├── voice/             # Voice endpoints
├── prisma/            # Prisma database service
├── common/            # Shared utilities and filters
└── main.ts            # Application entry point

prisma/
├── migrations/        # Database migrations
├── schema.prisma      # Prisma schema
└── seed.ts            # Database seed

public/
├── index.html
└── voice-test.html
```

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/1323saman/Voice-Desk-Salon-AI.git
cd Voice-Desk-Salon-AI
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL="your_postgresql_database_url"

GROQ_API_KEY="your_groq_api_key"
OPENAI_API_KEY="your_openai_api_key"
DEEPGRAM_API_KEY="your_deepgram_api_key"

RESEND_API_KEY="your_resend_api_key"

SENTRY_DSN="your_sentry_dsn"
```

> Never commit your `.env` file or expose API keys publicly.

### 4. Setup Prisma

```bash
npx prisma generate
npx prisma migrate dev
```

### 5. Start the application

Development mode:

```bash
npm run start:dev
```

The application runs at:

```text
http://localhost:3000
```

## 📖 Swagger API

Swagger documentation is available at:

```text
http://localhost:3000/api
```

Swagger provides an interactive interface for testing the available API endpoints.

## 🎙️ Voice Testing

The project includes a browser-based voice testing page:

```text
http://localhost:3000/voice-test.html
```

It can be used to test the voice interaction flow with the backend.

## 🧠 RAG Pipeline

The RAG pipeline allows the AI to generate responses using information stored in the application's knowledge base.

```text
User Query
    ↓
Generate Embedding
    ↓
Vector Similarity Search
    ↓
Retrieve Relevant Knowledge
    ↓
Build Context
    ↓
Groq LLM
    ↓
AI Response
```

This helps produce responses based on real business information instead of relying only on the model's general knowledge.

## 🔐 Environment Variables

| Variable           | Purpose               |
| ------------------ | --------------------- |
| `DATABASE_URL`     | PostgreSQL connection |
| `GROQ_API_KEY`     | Groq LLM access       |
| `OPENAI_API_KEY`   | Embedding generation  |
| `DEEPGRAM_API_KEY` | Speech-to-text        |
| `RESEND_API_KEY`   | Email delivery        |
| `SENTRY_DSN`       | Error monitoring      |

## 📌 API Modules

The backend includes modules for:

* **Chat** — AI conversational responses
* **Voice** — Voice interaction
* **Deepgram** — Speech-to-text processing
* **RAG** — Knowledge retrieval
* **Email** — Automated email operations
* **Prisma** — Database access

## 🧪 Development

Build the project:

```bash
npm run build
```

Run tests:

```bash
npm run test
```

Run end-to-end tests:

```bash
npm run test:e2e
```

Run linting:

```bash
npm run lint
```

## 🔮 Future Improvements

* Appointment booking
* Customer authentication
* WhatsApp integration
* Appointment reminders
* Admin dashboard
* Conversation analytics
* Multi-language voice support
* Online payments

## 👨‍💻 Author

**Saman**

GitHub: https://github.com/1323saman

## ⭐ Project

If you find this project useful, consider giving the repository a ⭐.

---

Built with **NestJS · Groq · RAG · Deepgram · PostgreSQL · Prisma · Resend · Swagger · Sentry**
