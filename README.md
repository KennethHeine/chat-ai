# Chat AI

A minimal yet modern frontend chat application built with React, TypeScript, and Tailwind CSS that integrates with the OpenAI Chat Completions API.

## Features

- 🚀 **Modern Tech Stack**: React + Vite + TypeScript + Tailwind CSS
- 💬 **Real-time Chat**: Stream responses from OpenAI as they arrive
- 📝 **Markdown Support**: Rich text rendering for assistant messages
- 💾 **Persistent History**: Conversations saved to localStorage
- 🧹 **Clear Chat**: Easily wipe conversation history
- 🔑 **Secure API Key**: Environment-based or user-provided API key

## Quick Start

1. **Clone and install dependencies**:

   ```bash
   git clone <your-repo-url>
   cd chat-ai
   npm install
   ```

2. **Set up your OpenAI API key**:
   - Copy `.env.example` to `.env`
   - Add your OpenAI API key: `VITE_OPENAI_API_KEY=your_key_here`
   - Or enter it in the app when prompted

3. **Start the development server**:

   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Technology Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with typography plugin
- **Icons**: Lucide React
- **Markdown**: Marked
- **Code Quality**: ESLint + Prettier + Husky pre-commit hooks
- **CI/CD**: GitHub Actions

## API Integration

This app integrates with the OpenAI Chat Completions API using server-sent events for real-time streaming responses. Make sure you have a valid OpenAI API key with access to the chat completions endpoint.
