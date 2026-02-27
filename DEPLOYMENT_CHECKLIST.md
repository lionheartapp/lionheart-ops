# Deployment Checklist - Auth.js & Onboarding

Complete checklist for deploying the Auth.js integration and onboarding services to production.

## Pre-Deployment (Development)

### Code Review
- [ ] All 7 files created and reviewed
- [ ] No console.error() statements left for debugging
- [ ] All TODOs addressed
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] Prettier formatting applied: `npm run format`
- [ ] ESLint passes: `npm run lint`

### Local Testing
- [ ] Start dev server: `npm run dev`
- [ ] School lookup endpoint works with test URL
- [ ] Member import endpoint works with test data
- [ ] Finalize endpoint completes successfully
- [ ] All error cases handled correctly (400, 401, 403, 404, 409)
- [ ] API responses match specification
- [ ] Email sending works (check logs or test inbox)
- [ ] File uploads to Supabase Storage work

### Environment Variables
- [ ] `.env.local` has all required variables
- [ ] No secrets in git history: `git log --all -p | grep -i "secret\|key" | head -5`
- [ ] AUTH_SECRET generated: `npm run auth:secret`
- [ ] Database URLs verified
- [ ] Gemini API key valid and has quota
- [ ] Supabase project and service role key verified
- [ ] Email service credentials tested

### Database
- [ ] Latest migrations applied: `npm run db:push`
- [ ] Prisma schema compiles: `npx prisma validate`
- [ ] Organization seed data exists
- [ ] Default roles and teams created
- [ ] `logos` bucket exists in Supabase Storage
- [ ] Storage bucket policies allow authenticated uploads

## Staging Deployment

### Before Deploy
- [ ] Create git tag: `git tag v1.0.0-onboarding`
- [ ] Push to staging branch: `git push origin staging`
- [ ] Review GitHub Actions/CI logs
- [ ] No build errors or security warnings

### Vercel/Hosting Setup
- [ ] Create `.env` file with staging credentials
- [ ] OAuth redirect URIs updated in provider dashboards:
  - Google: `https://staging.lionheartapp.com/api/auth/callback/google`
  - Azure: `https://staging.lionheartapp.com/api/auth/callback/azure-ad`
- [ ] NEXTAUTH_URL set to staging domain
- [ ] Database connection pooling configured

### Post-Deploy
- [ ] Service is running: `curl -I https://staging.lionheartapp.com`
- [ ] Auth endpoints respond: `curl https://staging.lionheartapp.com/api/auth/session`
- [ ] School lookup works: Test via Postman/curl
- [ ] Member import works: Test with 10-member batch
- [ ] Finalize endpoint works: Test full onboarding flow
- [ ] Email delivery verified (check staging inbox)
- [ ] Logs accessible and monitored
- [ ] Error tracking (Sentry/similar) configured

### Security Testing
- [ ] CSRF protection enabled
- [ ] XSS prevention verified (no direct HTML injection)
- [ ] SQL injection impossible (Prisma ORM)
- [ ] Rate limiting in place (if configured)
- [ ] JWT token validation works
- [ ] Organization scoping enforced
- [ ] Soft-delete restoration works (user recovery)

### Performance Testing
- [ ] School lookup < 10s response time
- [ ] Member import batch (500) completes < 30s
- [ ] Database queries optimized (check indexes)
- [ ] No N+1 queries
- [ ] API response sizes reasonable (< 1MB)

## Production Deployment

### Final Checks
- [ ] All staging tests passed
- [ ] Product team approved changes
- [ ] Marketing team has messaging ready
- [ ] Support team trained on new flow
- [ ] Rollback plan in place

### Secret Management
- [ ] All secrets in environment (not in code)
- [ ] AUTH_SECRET rotated for production
- [ ] OAuth secrets updated from production provider accounts
- [ ] API keys have appropriate permissions (not overly broad)
- [ ] Secrets never logged or exposed in errors

### DNS & Domain
- [ ] CNAME records updated (if new subdomain)
- [ ] SSL certificate issued and valid
- [ ] NEXTAUTH_URL points to production domain
- [ ] Cookie domain configured correctly
- [ ] CORS headers allow production domain

### Database
- [ ] Production database backups enabled
- [ ] Migration tested against prod schema
- [ ] Data retention policies set
- [ ] Connection pooling optimized for prod load
- [ ] Read replicas configured (if applicable)

### Supabase Storage
- [ ] `logos` bucket created in production project
- [ ] Bucket policies allow service role access
- [ ] Bucket policies allow public read
- [ ] Bucket quota adequate for expected uploads
- [ ] CDN/edge caching enabled

### Email Service
- [ ] Production Resend/SMTP account set up
- [ ] Sender domain verified and authorized
- [ ] Email templates reviewed for production
- [ ] Welcome email tested with real account
- [ ] Email bounce handling configured
- [ ] Unsubscribe list managed (if applicable)

### OAuth Providers
- [ ] Google credentials added to production app
- [ ] Google OAuth consent screen reviewed
- [ ] Azure app registered in production tenant
- [ ] Azure redirect URIs updated
- [ ] Azure tenant ID correct (not common)
- [ ] Both providers tested end-to-end

### Monitoring & Logging
- [ ] Error tracking configured (Sentry/DataDog)
- [ ] Log aggregation set up (CloudWatch/Loggly)
- [ ] Alerts configured for:
  - [ ] Failed sign-ins (threshold)
  - [ ] School lookup API errors
  - [ ] Member import failures
  - [ ] Email sending failures
  - [ ] Database connection errors
- [ ] Uptime monitoring enabled
- [ ] Performance monitoring enabled (APM)

### Documentation
- [ ] IMPLEMENTATION_SUMMARY.md accurate
- [ ] AUTH_INTEGRATION_GUIDE.md deployed
- [ ] ONBOARDING_API_SPEC.md deployed
- [ ] API documentation updated (Swagger/OpenAPI)
- [ ] Runbook created for common issues
- [ ] Support tickets template updated

### User Communication
- [ ] Product announcement ready
- [ ] Help documentation published
- [ ] In-app tooltips added
- [ ] Email announcement scheduled
- [ ] Admin onboarding guide prepared
- [ ] Support team contact info shared

## Production Go-Live

### Deployment Steps
1. [ ] Create production release: `git tag v1.0.0`
2. [ ] Trigger production deployment
3. [ ] Wait for deployment to complete
4. [ ] Verify health checks pass
5. [ ] Smoke test all endpoints
6. [ ] Monitor error rates for 1 hour
7. [ ] Communicate status to team

### Post-Launch Monitoring
- [ ] Error rate normal (< 1%)
- [ ] Response times acceptable (< 2s p95)
- [ ] No increase in database load
- [ ] Email delivery working
- [ ] User sign-ups flowing smoothly
- [ ] OAuth sign-ins working
- [ ] File uploads to storage working

### Support Preparation
- [ ] Support team on standby (first 4 hours)
- [ ] Escalation path clear
- [ ] Rollback plan ready to execute
- [ ] Known issues documented
- [ ] FAQ prepared for common questions

### Success Criteria
- [ ] 0 critical errors in first 24h
- [ ] > 99.5% uptime
- [ ] All email notifications delivered
- [ ] All file uploads successful
- [ ] User feedback positive
- [ ] No data corruption

## Post-Launch (1-Week)

### Week 1 Monitoring
- [ ] Error rates normal and stable
- [ ] User adoption growing
- [ ] Member import batches completing
- [ ] Finalization flows completing
- [ ] Email deliverability high
- [ ] No security incidents

### Analytics Review
- [ ] Track school lookups performed
- [ ] Track members imported
- [ ] Track onboarding completions
- [ ] Monitor sign-in methods used
- [ ] Identify any failing patterns

### Optimization
- [ ] Review slow queries
- [ ] Optimize database indexes (if needed)
- [ ] Cache frequently-accessed data
- [ ] Consider rate limit adjustments
- [ ] Review and reduce error logs

### Bug Fixes
- [ ] Monitor for reported issues
- [ ] Deploy hotfixes as needed
- [ ] Backport to staging for testing
- [ ] Document all issues in issue tracker

## Ongoing Maintenance

### Weekly
- [ ] Check monitoring dashboards
- [ ] Review error logs for patterns
- [ ] Monitor API response times
- [ ] Check storage quota usage
- [ ] Verify email delivery rates

### Monthly
- [ ] Review security logs
- [ ] Update dependencies (if needed)
- [ ] Rotate API keys (if recommended)
- [ ] Review and adjust rate limits
- [ ] Backup database export

### Quarterly
- [ ] Security audit of changes
- [ ] Performance review and optimization
- [ ] Capacity planning for growth
- [ ] User feedback collection
- [ ] Documentation updates

### Annually
- [ ] AUTH_SECRET rotation
- [ ] OAuth credentials refresh
- [ ] Full security assessment
- [ ] Disaster recovery drill
- [ ] Architecture review

## Rollback Plan

### If Critical Issues Occur

1. **Immediate (< 5 min)**
   - [ ] Alert team
   - [ ] Gather error context
   - [ ] Assess impact scope

2. **Decision Point (5-15 min)**
   - [ ] Is issue critical? (Yes → rollback)
   - [ ] Can be fixed without rollback? (Yes → hotfix)
   - [ ] Rate of failures acceptable? (No → rollback)

3. **Rollback Execution (15-30 min)**
   - [ ] Revert to previous stable tag
   - [ ] Verify rollback completes
   - [ ] Smoke test all endpoints
   - [ ] Communicate status to users
   - [ ] Investigation begins

4. **Post-Rollback (30 min+)**
   - [ ] Root cause analysis
   - [ ] Fix identified issues
   - [ ] Test thoroughly in staging
   - [ ] Plan re-deployment
   - [ ] Update incident report

### Rollback Checklist
- [ ] Previous version image/build available
- [ ] Database migrations are reversible (or no schema changes)
- [ ] Secret keys compatible with previous version
- [ ] DNS failover ready (if applicable)
- [ ] Communication template prepared
- [ ] User communication plan ready

## Sign-Off

- [ ] Engineering Lead: __________ Date: __________
- [ ] Product Manager: __________ Date: __________
- [ ] DevOps/Infrastructure: __________ Date: __________
- [ ] Security/Compliance: __________ Date: __________
- [ ] Support Lead: __________ Date: __________

## Notes

```
Add any deployment-specific notes here:
- Known limitations
- Manual steps required
- Special considerations
- Team contacts and phone numbers
```

---

## Useful Commands

### Pre-deployment
```bash
# Verify everything builds
npm run build

# Check for security vulnerabilities
npm audit

# Lint and format
npm run lint && npm run format

# Run tests (if available)
npm test

# Generate TypeScript types
npx prisma generate
```

### Deployment
```bash
# Create production tag
git tag -a v1.0.0 -m "Auth.js integration and onboarding"
git push origin v1.0.0

# View deployment logs
vercel logs [--tail]

# Check function logs
vercel logs [function-name] [--tail]
```

### Post-deployment
```bash
# Test endpoint
curl https://api.lionheartapp.com/api/onboarding/school-lookup \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"website": "example.edu"}'

# Monitor errors
vercel logs --error [--tail]

# Check environment
vercel env ls
```

---

## Additional Resources

- Auth.js Docs: https://authjs.dev
- Next.js Deployment: https://nextjs.org/docs/deployment
- Supabase Docs: https://supabase.com/docs
- Vercel Dashboard: https://vercel.com/dashboard
- Error Tracking: [Your error tracking service]
- Incident Response: [Your incident response playbook]
