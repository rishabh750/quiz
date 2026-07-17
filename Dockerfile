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
CMD ["java", "-jar", "app.jar"]
