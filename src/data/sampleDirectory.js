/**
 * Sample staff directory for demos. In production, users come from Platform DB (User table).
 * Replace or extend with your school's data as needed.
 */

// Standard K-12 teams
export const DIRECTORY_TEAMS = [
  { id: 'elementary', name: 'Elementary School' },
  { id: 'middle-school', name: 'Middle School' },
  { id: 'high-school', name: 'High School' },
  { id: 'admin', name: 'Admin' },
  { id: 'it', name: 'IT' },
  { id: 'campus-safety', name: 'Campus Safety' },
  { id: 'facilities', name: 'Campus Services' },
  { id: 'athletics', name: 'Athletics' },
  { id: 'teachers', name: 'Teachers' },
  { id: 'av', name: 'A/V' },
]

// Sample users for demo (generic names, @school.edu)
export const DIRECTORY_USERS = [
  { id: 'u1', name: 'Alex Johnson', email: 'ajohnson@school.edu', teamIds: ['elementary', 'admin'], role: 'creator' },
  { id: 'u2', name: 'Jordan Smith', email: 'jsmith@school.edu', teamIds: ['elementary'], role: 'creator' },
  { id: 'u3', name: 'Casey Williams', email: 'cwilliams@school.edu', teamIds: ['middle-school'], role: 'creator' },
  { id: 'u4', name: 'Morgan Davis', email: 'mdavis@school.edu', teamIds: ['middle-school', 'admin'], role: 'creator' },
  { id: 'u5', name: 'Taylor Brown', email: 'tbrown@school.edu', teamIds: ['high-school'], role: 'creator' },
  { id: 'u6', name: 'Riley Miller', email: 'rmiller@school.edu', teamIds: ['high-school', 'athletics'], role: 'creator' },
  { id: 'u7', name: 'Jordan Taylor', email: 'jtaylor@school.edu', teamIds: ['it'], role: 'creator' },
  { id: 'u8', name: 'Sam Wilson', email: 'swilson@school.edu', teamIds: ['it'], role: 'creator' },
  { id: 'u9', name: 'Chris Martinez', email: 'cmartinez@school.edu', teamIds: ['facilities'], role: 'creator' },
  { id: 'u10', name: 'Jamie Garcia', email: 'jgarcia@school.edu', teamIds: ['facilities'], role: 'creator' },
  { id: 'u11', name: 'Pat Lee', email: 'plee@school.edu', teamIds: ['admin'], role: 'admin' },
  { id: 'u12', name: 'Casey Anderson', email: 'canderson@school.edu', teamIds: ['admin'], role: 'creator' },
]
