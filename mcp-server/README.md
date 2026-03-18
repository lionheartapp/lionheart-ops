# Lionheart MCP Server

Model Context Protocol server for the Lionheart Operations Platform. Gives AI assistants (Claude, Leo, Cursor, etc.) the ability to query and interact with your school management data.

## Tools Available

### Calendar & Events
- **search_events** — Search calendar events within a date range
- **check_room_availability** — Check if a room/building is free during a time range
- **list_buildings_and_rooms** — List all venues for event planning
- **get_event_details** — Full event details including approvals, attendees, resources
- **list_event_templates** — Browse saved event templates

### Campus & Organization
- **list_campuses** — All campuses in the organization
- **list_teams** — Teams (IT, Maintenance, AV, Teachers, etc.)
- **list_staff** — Staff members, optionally filtered by team
- **get_school_info** — Organization details, grade levels, contacts

### Maintenance & Facilities
- **list_maintenance_tickets** — Active maintenance tickets
- **check_facility_status** — Check if a building has active issues

## Setup

```bash
cd mcp-server
npm install
```

## Configuration

Set these environment variables:

```
LIONHEART_API_URL=https://yourschool.lionheartapp.com
LIONHEART_API_KEY=your-service-api-key
```

## Usage with Claude Code

The server is pre-configured in `.mcp.json`. When using Claude Code in this project, the Lionheart tools are automatically available.

## Usage with Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "lionheart": {
      "command": "npx",
      "args": ["tsx", "/path/to/lionheart-ops/mcp-server/src/index.ts"],
      "env": {
        "LIONHEART_API_URL": "https://yourschool.lionheartapp.com",
        "LIONHEART_API_KEY": "your-key"
      }
    }
  }
}
```
