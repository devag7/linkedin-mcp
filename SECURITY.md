# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Active support  |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** create a public GitHub issue
2. **Email**: Send details to the project maintainer
3. **Include**: Description, steps to reproduce, potential impact

We will respond within 48 hours and aim to release a fix within 7 days for critical issues.

## Security Considerations

### Authentication
- **Never** commit LinkedIn credentials to source control
- Use environment variables for all secrets
- Cookie-based auth tokens should be rotated regularly
- OAuth tokens have automatic expiration

### Data Handling
- The server does not store any LinkedIn data persistently
- All caching is in-memory and ephemeral
- Log output redacts sensitive tokens and cookies
- No data is sent to any third-party service

### Network Security
- HTTP transport supports CORS with configurable origins
- All LinkedIn API calls use HTTPS
- Rate limiting prevents abuse
- Request timeouts prevent hanging connections

### Docker Security
- Production Docker image runs as non-root user
- Minimal base image (Alpine) reduces attack surface
- No unnecessary packages installed

## Best Practices for Users

1. Use **OAuth** authentication when possible (official, TOS-compliant)
2. Set **strict rate limits** to avoid LinkedIn account restrictions
3. Run in **Docker** or **remote mode** to isolate from your local environment
4. Regularly **rotate** session cookies if using cookie-based auth
5. Review **logs** for any unexpected authentication failures
