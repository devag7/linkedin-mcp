# Contributing to LinkedIn MCP

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## 🚀 Quick Setup

```bash
# Clone the repo
git clone https://github.com/devag7/linkedin-mcp.git
cd linkedin-mcp

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck
```

## 📋 Development Workflow

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Make** your changes
4. **Test** your changes: `npm test && npm run typecheck`
5. **Commit** with conventional commits: `git commit -m 'feat: add new tool'`
6. **Push** to your fork: `git push origin feature/my-feature`
7. **Open** a Pull Request

## 📦 Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature or tool
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `test:` — Adding or updating tests
- `refactor:` — Code refactoring
- `chore:` — Maintenance tasks

## 🧪 Testing

- Write tests for all new tools and features
- Place tests in the `tests/` directory
- Use `vitest` for testing
- Mock external API calls — never make real LinkedIn requests in tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## 🛠 Adding a New Tool

1. Add the tool registration in `src/server.ts` under the appropriate category
2. Use `safeToolCall()` wrapper for error handling
3. Add Zod schema validation for all parameters
4. Add tests in `tests/`
5. Update `README.md` tool list
6. Update the tool count in `whoami`

### Tool Template

```typescript
server.tool(
  'tool_name',
  'Description of what the tool does.',
  {
    param1: z.string().describe('Parameter description'),
    param2: z.number().int().min(1).max(50).default(10).describe('Optional with default'),
  },
  async ({ param1, param2 }) => {
    return safeToolCall(logger, 'tool_name', async () => {
      const data = await client.voyagerGet(`/api/endpoint/${param1}?count=${param2}`);
      return formatResult(data);
    });
  },
);
```

## 🏗 Architecture

```
src/
├── index.ts          # CLI entry point
├── server.ts         # MCP server + all tool registrations
├── types.ts          # Shared types + Logger
├── auth/             # Authentication (OAuth + Cookie)
├── client/           # LinkedIn HTTP client
├── config/           # Environment configuration
├── middleware/        # Rate limiter, cache
└── transports/       # stdio + HTTP transport
```

## 📏 Code Style

- TypeScript strict mode
- ESM modules
- Prettier for formatting
- ESLint for linting

```bash
npm run format    # Format code
npm run lint      # Check linting
npm run lint:fix  # Auto-fix lint issues
```

## 🐛 Reporting Bugs

Use the [Bug Report template](https://github.com/devag7/linkedin-mcp/issues/new?template=bug_report.md).

## 💡 Feature Requests

Use the [Feature Request template](https://github.com/devag7/linkedin-mcp/issues/new?template=feature_request.md).

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.
