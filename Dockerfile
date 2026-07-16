FROM node:20-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN npm run build

FROM azul/zulu-openjdk:21 AS backend
WORKDIR /build
COPY backend/.mvn ./.mvn
COPY backend/mvnw backend/pom.xml ./
RUN ./mvnw -q -B dependency:go-offline
COPY backend/src ./src
RUN ./mvnw -q -B -DskipTests package

FROM azul/zulu-openjdk:21-jre-headless
ENV STATIC_DIR=static \
    SECRET_DIR=/data \
    PORT=8000 \
    DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
         -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" \
         > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY --from=backend /build/target/app.jar ./app.jar
COPY --from=frontend /app/dist ./static
COPY docker/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh
EXPOSE 8000
VOLUME ["/var/lib/postgresql/data", "/data"]
CMD ["/usr/local/bin/start.sh"]
