# CareerGuide AI — the web app, as a container.
#
# Three stages, because a Next build needs the whole dependency tree and a Next
# runtime needs none of it: `node_modules` for this app is hundreds of MB, and only a
# fraction of it is touched by `next start`. The standalone output is the part that is
# actually needed, so that is all the last stage carries.
#
# Node 24 to match the machine every build of this app has been verified on.

FROM node:24-alpine AS deps
WORKDIR /app

# Only the manifests at first, so `npm ci` is re-run when a dependency changes and not
# when a component does.
COPY package.json package-lock.json ./
# `npm ci`, never `npm install`: the lockfile is the record of what passed, and an
# install that quietly upgrades a minor version inside the image is a build that tested
# something else.
RUN npm ci --no-audit --no-fund


FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY tsconfig.json next.config.ts eslint.config.mjs ./
COPY public ./public
COPY src ./src
COPY scripts ./scripts

# `NEXT_PUBLIC_*` is inlined into the client bundle at build time, so the address a
# browser must reach the API on is a build argument here, not a run-time variable —
# which is the one property of a containerised frontend that surprises people. An image
# built with `http://localhost:8000` baked in will not talk to an API on another host,
# and there is no env var that will fix it after the fact; it needs a rebuild. The
# compose file passes it, and says so.
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    # The switch that asks `next.config.ts` for the self-contained output this stage
    # exists to copy. Deliberately unset on Vercel, which does not run `next start`.
    NEXT_DOCKER_STANDALONE=1

# The production build is the test. Next fails a build on a type error, and `npm run
# build` here also runs the repo's own checks — a container that starts and then 500s on
# a page nobody typechecked is not a deployment.
RUN npm run build


FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# A named, unprivileged user. Next writes nothing at run time, so there is no reason for
# the process to be able to.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# `standalone` already contains the traced `node_modules` the server needs. The two
# directories added on top of it are the ones Next keeps out of it by design.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# `public/` is served verbatim — the manifest, the icons and `sw.js` all live here, and
# a PWA whose service worker 404s is a PWA that is not installed.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# A real request, not a port check: this answers whether the renderer, the middleware
# and the security headers are all actually up.
#
# Written as one statement, not `process.exit(http.get(...))` — `get()` and `on()` both
# return the *request*, and `process.exit` was given that object instead of a number, so
# the check threw `ERR_INVALID_ARG_TYPE` and a perfectly healthy renderer was reported
# unhealthy. The timeout listener has to destroy the request too, otherwise a hung
# renderer leaves the probe waiting for Docker to kill it rather than saying so.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:3000,path:'/',timeout:4000},r=>process.exit(r.statusCode<500?0:1)).on('timeout',function(){this.destroy();process.exit(1)}).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
