# StudentHub 📚

> Your AI-powered study companion for academic success.

StudentHub is a comprehensive student productivity platform that combines notes, tasks, exam preparation, CGPA tracking, and AI-powered study tools in one beautiful, modern interface.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38B2AC?logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-Database-3FCF8E?logo=supabase)

## ✨ Features

### Core Features
- **📝 Smart Notes** - Rich text editor with AI-powered summaries and organization
- **✅ Task Management** - Kanban boards with priorities, due dates, and sub-tasks
- **📅 Timetable** - Class schedule management with break periods
- **🎯 Exam Prep** - AI-generated practice questions, flashcards, and study guides
- **📊 CGPA Calculator** - Track grades, calculate SGPA/CGPA, and plan future performance
- **⏱️ Pomodoro Timer** - Stay focused with customizable work sessions
- **📆 Calendar** - Unified view of classes, tasks, and assignments
- **🔔 Reminders** - Never miss a deadline with smart notifications
- **💰 Budget Tracker** - Manage student expenses
- **📖 Citation Manager** - Generate citations in various formats

### AI Features (Powered by Gemini)
- **Study Buddy Chat** - 24/7 AI tutor for explanations and study help
- **Auto Summaries** - Generate summaries from notes
- **Quiz Generation** - Create practice questions from your content
- **PDF/Image Extraction** - Import grades and content from documents

### Integrations
- **Google Classroom** - Sync assignments and courses
- **Google Tasks** - Two-way task synchronization
- **Google Calendar** - View events in your calendar

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 15 (App Router) |
| Frontend | React 19, TailwindCSS v4 |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth + Google OAuth |
| AI | Google Gemini |
| UI Components | Radix UI, shadcn/ui |
| Rich Text | TipTap |
| PWA | next-pwa |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Google Cloud Console project (for Google integrations)
- Google AI (Gemini) API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/student-hub.git
   cd student-hub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # Google OAuth (for Classroom, Tasks, Calendar)
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   
   # Google Gemini AI
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Set up Supabase**
   - Create a new Supabase project
   - Run the SQL migrations from `/supabase` folder
   - Enable Google Auth provider in Supabase Dashboard

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
student-hub/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── auth/              # Auth pages
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── dashboard/        # Dashboard widgets
│   └── ...               # Feature components
├── lib/                   # Utility functions
│   ├── supabase/         # Supabase clients
│   ├── gemini.ts         # AI utilities
│   └── utils.ts          # General utilities
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript types
└── public/               # Static assets
```

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## 🌐 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy!

### Environment Variables for Production

Ensure all environment variables from `.env.local` are configured in your deployment platform.

## 📱 PWA Support

StudentHub is a Progressive Web App and can be installed on mobile devices and desktops for an app-like experience.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

Built with ❤️ by [Arush Nandakumar Menon](https://github.com/arushn47)
