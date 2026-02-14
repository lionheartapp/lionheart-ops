export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        School Facility Management
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Next.js + Prisma + Supabase — Foundation ready.
      </p>
      <a
        href="/login"
        className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90"
      >
        Sign in
      </a>
      <a
        href="/admin/users"
        className="mt-2 inline-flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        User permissions
      </a>
      <a
        href="/events/request"
        className="mt-2 inline-flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        Event Request
      </a>
      <a
        href="/maintenance/visual-assist"
        className="mt-2 inline-flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        Visual AI — Repair Assistant
      </a>
      <a
        href="/campus"
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90"
      >
        Campus Map (360° Tour)
      </a>
      <ul className="mt-6 list-disc text-left text-sm text-zinc-500 dark:text-zinc-400 space-y-1">
        <li>Users (Teacher, Maintenance, Admin, Site Secretary)</li>
        <li>Buildings & Rooms (Matterport_URL, Coordinates)</li>
        <li>TeacherSchedules (DayOfWeek, StartTime, EndTime, RoomID, Subject)</li>
        <li>Tickets (Category, Status, Priority, ManHours, SafetyProtocolChecklist)</li>
        <li>Inventory (Tables, Chairs, shared resources)</li>
      </ul>
    </main>
  )
}
