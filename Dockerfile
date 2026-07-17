FROM node:20-alpine AS frontend
WORKDIR /ui
COPY ui/package.json ui/package-lock.json* ./
RUN npm ci || npm install
COPY ui/ ./
RUN npm run build

FROM azul/zulu-openjdk:21 AS build
WORKDIR /build
COPY .mvn ./.mvn
COPY mvnw pom.xml ./
RUN ./mvnw -q -B dependency:go-offline
COPY src ./src
RUN ./mvnw -q -B -DskipTests package

FROM azul/zulu-openjdk:21-jre-headless
WORKDIR /srv
ENV STATIC_DIR=static SECRET_DIR=/tmp PORT=8000
COPY --from=build /build/target/app.jar ./app.jar
COPY --from=frontend /ui/dist ./static
EXPOSE 8000
# -Djava.security.egd=…urandom: non-blocking entropy so RSA/JWT key generation
#   can't stall behind /dev/random on a fresh container (Vercel has a 15s bind limit).
# TieredStopAtLevel=1 + SerialGC: trim JVM cold-start so Tomcat binds well inside it.
CMD ["java", "-Djava.security.egd=file:/dev/./urandom", "-XX:TieredStopAtLevel=1", "-XX:+UseSerialGC", "-jar", "app.jar"]
