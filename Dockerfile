FROM node:22-alpine AS build
WORKDIR /app
COPY livrejam/package.json livrejam/package-lock.json ./
RUN npm ci
COPY livrejam/ .
RUN npx ng build --configuration=production

FROM python:3.12-alpine
WORKDIR /app
COPY --from=build /app/dist/livrejam/browser .

EXPOSE 8267
CMD ["python3", "-m", "http.server", "8267"]
