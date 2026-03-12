/**
 * AI Assistant — Users & Teams Domain Tools
 *
 * All new: invite_user, update_user_role, add_user_to_team,
 *          remove_user_from_team, deactivate_user
 */

import { registerTools, type ToolRegistryEntry } from './_registry'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { clearPermissionCache } from '@/lib/auth/permissions'

const tools: Record<string, ToolRegistryEntry> = {
  // ── ORANGE: Invite User ──────────────────────────────────────────────────
  invite_user: {
    definition: {
      name: 'invite_user',
      description: 'Invite a new user to the organization. Returns confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name of the person to invite' },
          email: { type: 'string', description: 'Email address' },
          role: { type: 'string', description: 'Role to assign (e.g. "member", "admin", "teacher")' },
        },
        required: ['name', 'email'],
      },
    },
    requiredPermission: PERMISSIONS.USERS_INVITE,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const name = String(input.name || '')
      const email = String(input.email || '')
      const role = String(input.role || 'member')

      if (!email.includes('@')) return JSON.stringify({ error: 'Invalid email address.' })

      // Check if user already exists
      const existing = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, name: true },
      }).catch(() => null)
      if (existing) return JSON.stringify({ error: `A user with email "${email}" already exists (${existing.name}).` })

      const draft = { action: 'invite_user', name, email, role }
      return JSON.stringify({
        confirmationRequired: true,
        message: `Invite ${name} (${email}) as ${role}?`,
        draft,
      })
    },
  },

  // ── RED: Update User Role ────────────────────────────────────────────────
  update_user_role: {
    definition: {
      name: 'update_user_role',
      description: 'Change a user\'s role. This is a sensitive action — returns confirmation with warning.',
      parameters: {
        type: 'object',
        properties: {
          user_name: { type: 'string', description: 'Name or email of the user' },
          new_role: { type: 'string', description: 'New role slug (e.g. "admin", "member", "teacher")' },
        },
        required: ['user_name', 'new_role'],
      },
    },
    requiredPermission: PERMISSIONS.USERS_MANAGE_ROLES,
    riskTier: 'RED',
    execute: async (input) => {
      const userName = String(input.user_name || '')
      const newRole = String(input.new_role || '')

      const user = await prisma.user.findFirst({
        where: { OR: [{ name: { contains: userName, mode: 'insensitive' } }, { email: { contains: userName, mode: 'insensitive' } }] },
        select: { id: true, name: true, email: true, userRole: { select: { name: true, slug: true } } },
      })
      if (!user) return JSON.stringify({ error: `Could not find user matching "${userName}".` })

      const role = await prisma.role.findFirst({ where: { slug: newRole }, select: { id: true, name: true, slug: true } })
      if (!role) return JSON.stringify({ error: `Role "${newRole}" not found.` })

      const draft = { action: 'update_user_role', userId: user.id, roleId: role.id, userName: user.name, currentRole: user.userRole?.name, newRoleName: role.name }
      return JSON.stringify({
        confirmationRequired: true,
        riskTier: 'RED',
        riskWarning: `Changing ${user.name}'s role from "${user.userRole?.name || 'none'}" to "${role.name}" will immediately change their permissions across the platform.`,
        message: `Change ${user.name}'s role to ${role.name}?`,
        draft,
      })
    },
  },

  // ── YELLOW: Add User to Team ─────────────────────────────────────────────
  add_user_to_team: {
    definition: {
      name: 'add_user_to_team',
      description: 'Add a user to a team. Executes immediately.',
      parameters: {
        type: 'object',
        properties: {
          user_name: { type: 'string', description: 'Name or email of the user' },
          team_name: { type: 'string', description: 'Name of the team' },
        },
        required: ['user_name', 'team_name'],
      },
    },
    requiredPermission: PERMISSIONS.TEAMS_UPDATE,
    riskTier: 'YELLOW',
    execute: async (input) => {
      const userName = String(input.user_name || '')
      const teamName = String(input.team_name || '')

      const user = await prisma.user.findFirst({
        where: { OR: [{ name: { contains: userName, mode: 'insensitive' } }, { email: { contains: userName, mode: 'insensitive' } }] },
        select: { id: true, name: true },
      })
      if (!user) return JSON.stringify({ error: `Could not find user matching "${userName}".` })

      const team = await prisma.team.findFirst({
        where: { name: { contains: teamName, mode: 'insensitive' } },
        select: { id: true, name: true },
      })
      if (!team) return JSON.stringify({ error: `Could not find team matching "${teamName}".` })

      // Check if already a member
      const existing = await prisma.userTeam.findUnique({
        where: { userId_teamId: { userId: user.id, teamId: team.id } },
      }).catch(() => null)
      if (existing) return JSON.stringify({ executed: true, message: `${user.name} is already a member of ${team.name}.` })

      await prisma.userTeam.create({ data: { userId: user.id, teamId: team.id } })
      return JSON.stringify({ executed: true, message: `Added ${user.name} to ${team.name}.` })
    },
  },

  // ── YELLOW: Remove User from Team ────────────────────────────────────────
  remove_user_from_team: {
    definition: {
      name: 'remove_user_from_team',
      description: 'Remove a user from a team. Executes immediately.',
      parameters: {
        type: 'object',
        properties: {
          user_name: { type: 'string', description: 'Name or email of the user' },
          team_name: { type: 'string', description: 'Name of the team' },
        },
        required: ['user_name', 'team_name'],
      },
    },
    requiredPermission: PERMISSIONS.TEAMS_UPDATE,
    riskTier: 'YELLOW',
    execute: async (input) => {
      const userName = String(input.user_name || '')
      const teamName = String(input.team_name || '')

      const user = await prisma.user.findFirst({
        where: { OR: [{ name: { contains: userName, mode: 'insensitive' } }, { email: { contains: userName, mode: 'insensitive' } }] },
        select: { id: true, name: true },
      })
      if (!user) return JSON.stringify({ error: `Could not find user matching "${userName}".` })

      const team = await prisma.team.findFirst({
        where: { name: { contains: teamName, mode: 'insensitive' } },
        select: { id: true, name: true },
      })
      if (!team) return JSON.stringify({ error: `Could not find team matching "${teamName}".` })

      await prisma.userTeam.delete({
        where: { userId_teamId: { userId: user.id, teamId: team.id } },
      }).catch(() => null)

      return JSON.stringify({ executed: true, message: `Removed ${user.name} from ${team.name}.` })
    },
  },

  // ── RED: Deactivate User ─────────────────────────────────────────────────
  deactivate_user: {
    definition: {
      name: 'deactivate_user',
      description: 'Deactivate (soft-delete) a user account. This is a destructive action — returns confirmation with warning.',
      parameters: {
        type: 'object',
        properties: {
          user_name: { type: 'string', description: 'Name or email of the user to deactivate' },
          reason: { type: 'string', description: 'Reason for deactivation' },
        },
        required: ['user_name'],
      },
    },
    requiredPermission: PERMISSIONS.USERS_UPDATE,
    riskTier: 'RED',
    execute: async (input) => {
      const userName = String(input.user_name || '')

      const user = await prisma.user.findFirst({
        where: { OR: [{ name: { contains: userName, mode: 'insensitive' } }, { email: { contains: userName, mode: 'insensitive' } }] },
        select: { id: true, name: true, email: true, userRole: { select: { name: true } } },
      })
      if (!user) return JSON.stringify({ error: `Could not find user matching "${userName}".` })

      const draft = {
        action: 'deactivate_user',
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        reason: String(input.reason || ''),
      }

      return JSON.stringify({
        confirmationRequired: true,
        riskTier: 'RED',
        riskWarning: `This will deactivate ${user.name}'s account (${user.email}). They will no longer be able to log in. This action can only be reversed by an administrator.`,
        message: `Deactivate ${user.name} (${user.email})?`,
        draft,
      })
    },
  },
}

registerTools(tools)
