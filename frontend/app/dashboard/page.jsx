/**
 * Dashboard Root Page
 * Redirects to assistant page - no separate dashboard overview needed
 */

import { redirect } from 'next/navigation';

export default function DashboardPage() {
  redirect('/dashboard/assistant');
}
