# STANDARD OPERATING PROCEDURE: MAVEN MODULE REFACTORING FOR MONOREPO INTEGRATION

**Document ID:** SOP-MAVEN-MONOREPO-001  
**Version:** 1.0  
**Author:** Manus AI  
**Status:** Active  
**Scope:** All Maven modules being migrated from standalone repositories into the enterprise multimodule monorepo

---

## Table of Contents

1. [Module Assessment Summary](#1-module-assessment-summary)
2. [Directory Structure Setup](#2-directory-structure-setup)
3. [POM.XML Refactoring](#3-pomxml-refactoring)
4. [Dependency Resolution](#4-dependency-resolution)
5. [Build Configuration](#5-build-configuration)
6. [CI/CD Integration](#6-cicd-integration)
7. [Release Management Setup](#7-release-management-setup)
8. [Testing & Validation](#8-testing--validation)
9. [Documentation Requirements](#9-documentation-requirements)
10. [Compliance & Traceability Setup](#10-compliance--traceability-setup)
11. [Migration Checklist](#11-migration-checklist)
12. [Troubleshooting Guide](#12-troubleshooting-guide)
13. [Example Commands](#13-example-commands)
14. [References](#references)

---

## 1. Module Assessment Summary

Before any file is moved or any POM is edited, a thorough assessment of the module under migration must be completed. This section provides a structured discovery framework that applies regardless of module type, enabling the practitioner to determine the correct migration path with confidence.

### 1.1 Discovery Questionnaire

Answer every question in the following table before proceeding. The answers directly drive decisions in every subsequent section of this SOP.

| # | Question | Where to Find the Answer | Why It Matters |
|---|----------|--------------------------|----------------|
| Q1 | What is the Maven packaging type (`jar`, `war`, `pom`, `ear`)? | `<packaging>` in `pom.xml`; defaults to `jar` if absent | Determines module type category and applicable build plugins |
| Q2 | Does the module declare a `<parent>` element? | `pom.xml` `<parent>` block | Reveals whether a parent POM hierarchy already exists |
| Q3 | Does the module contain a `main` class or Spring Boot entry point? | `src/main/java` for `public static void main`; `@SpringBootApplication` annotation | Distinguishes deployable applications from libraries |
| Q4 | Does the module produce a container image (Docker/OCI)? | `pom.xml` for Jib, Dockerfile, or docker-maven-plugin | Requires Jib configuration in target monorepo |
| Q5 | Does the module generate source code from schemas? | `pom.xml` for protobuf-maven-plugin, openapi-generator, jaxb-maven-plugin, wsdl2java | Requires code-generation plugin preservation and path mapping |
| Q6 | Does the module have dependencies on other internal modules? | `pom.xml` `<dependencies>` for `com.company.*` groupIds | Requires dependency conversion from Artifactory to direct reference |
| Q7 | Does the module have circular dependencies with other modules? | Run `mvn dependency:tree` and inspect for cycles | Must be resolved before migration can complete |
| Q8 | What CI/CD system currently builds this module? | `.github/workflows/`, `Jenkinsfile`, `.gitlab-ci.yml`, `azure-pipelines.yml` | Informs CI/CD integration work in Section 6 |
| Q9 | What is the current versioning strategy? | `<version>` in `pom.xml`; release tags in Git history | Determines version migration path |
| Q10 | Does the module have integration or performance tests? | `src/test/` for `*IT.java`, `*IntegrationTest.java`; `pom.xml` for Failsafe plugin | Requires Failsafe configuration and test profile setup |
| Q11 | Does the module produce a shared library consumed by other teams? | Artifactory download statistics; other modules' `pom.xml` files | Requires careful versioning and backward-compatibility planning |
| Q12 | Does the module have environment-specific configurations? | `src/main/resources/application-*.properties`; Maven profiles | Requires profile preservation and environment variable mapping |
| Q13 | Are there compliance or regulatory requirements? | Security scan configs; SBOM generation; audit log configs | Drives Section 10 compliance setup |

### 1.2 Module Type Classification

Use the following decision tree to classify the module. The classification determines which subsections of this SOP are mandatory versus optional.

```
START: What is the <packaging> value?
│
├── pom
│   ├── Does it declare <modules>?
│   │   ├── YES → TYPE: Parent POM Module (see 1.3.A)
│   │   └── NO  → TYPE: BOM or Aggregator POM (see 1.3.B)
│
├── jar (or absent)
│   ├── Does it have a main class or @SpringBootApplication?
│   │   ├── YES → Does it produce a container image?
│   │   │         ├── YES → TYPE: Deployable Microservice (see 1.3.C)
│   │   │         └── NO  → TYPE: Standalone Application (see 1.3.D)
│   │   └── NO  → Does it generate source code from schemas?
│   │             ├── YES → TYPE: Generated Code Module (see 1.3.E)
│   │             └── NO  → Is it consumed only in test scope?
│   │                       ├── YES → TYPE: Test Utility Module (see 1.3.F)
│   │                       └── NO  → TYPE: Shared Library (see 1.3.G)
│
├── war / ear
│   └── TYPE: Legacy Web Application (see 1.3.H)
│
└── Other (maven-plugin, etc.)
    └── TYPE: Maven Plugin Module (see 1.3.I)
```

### 1.3 Module Type Profiles

Each profile summarises the key characteristics, mandatory SOP sections, and special considerations.

#### 1.3.A — Parent POM Module

A Parent POM module has `<packaging>pom</packaging>` and declares `<modules>`. Its primary purpose is to provide shared configuration, dependency management, and plugin management to child modules. It does not produce a deployable artifact.

**Mandatory SOP sections:** 1, 2, 3, 9, 11  
**Key characteristics:** No source code; `<dependencyManagement>` and `<pluginManagement>` are its primary content; it defines the reactor build order.  
**Special considerations:** In the monorepo, this module will typically be replaced by or merged into the suite-level or product-level parent POM. Evaluate whether a standalone parent POM should be promoted to a higher hierarchy level or absorbed.

#### 1.3.B — BOM (Bill of Materials) Module

A BOM module has `<packaging>pom</packaging>`, no `<modules>`, and contains a `<dependencyManagement>` section with version pins for a set of related libraries. It is imported by other POMs using `<scope>import</scope>`.

**Mandatory SOP sections:** 1, 2, 3, 4, 9, 11  
**Key characteristics:** Imported rather than inherited; must be published to be consumed; in the monorepo, it can be consumed directly without Artifactory.  
**Special considerations:** The BOM must be placed in a location that is built before any module that imports it. Ensure the reactor order reflects this dependency.

#### 1.3.C — Deployable Microservice

A Deployable Microservice has `<packaging>jar</packaging>`, a Spring Boot (or Quarkus/Micronaut) entry point, and produces a container image. It is the most common type of deployable artifact in a modern Java monorepo.

**Mandatory SOP sections:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13  
**Key characteristics:** Uses `spring-boot-maven-plugin` for repackaging; uses Jib for container image building; has environment-specific configuration; has integration tests.  
**Special considerations:** Container image registry configuration must be externalised to CI environment variables. Jib must be configured to skip image push during local development builds.

#### 1.3.D — Standalone Application

A Standalone Application has a main class but does not produce a container image. It may be a batch job, a command-line tool, or a legacy application packaged as a fat JAR.

**Mandatory SOP sections:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13  
**Key characteristics:** May use `maven-assembly-plugin` or `maven-shade-plugin` for packaging; does not require Jib configuration.  
**Special considerations:** If the application is a batch job, verify whether it is scheduled via a container orchestrator or an external scheduler, as this affects deployment pipeline configuration.

#### 1.3.E — Generated Code Module

A Generated Code Module contains schema files (`.proto`, `.yaml`, `.xsd`, `.wsdl`) and uses a Maven plugin to generate Java source code during the `generate-sources` lifecycle phase.

**Mandatory SOP sections:** 1, 2, 3, 4, 5, 8, 9, 11, 12, 13  
**Key characteristics:** Source code in `target/generated-sources/` must not be committed to version control; the `.proto`/`.yaml`/`.xsd` files are the true source of truth; downstream modules depend on this module's compiled output.  
**Special considerations:** The generated sources directory must be added to `.gitignore`. The code generation plugin must be configured with `<checkStaleness>true</checkStaleness>` where supported to avoid unnecessary regeneration.

#### 1.3.F — Test Utility Module

A Test Utility Module provides shared test fixtures, builders, mock implementations, or test infrastructure. It is consumed only in `<scope>test</scope>` by other modules.

**Mandatory SOP sections:** 1, 2, 3, 4, 8, 9, 11  
**Key characteristics:** Often published with a `tests` classifier using `maven-jar-plugin`'s `test-jar` goal; should be placed in a `shared/testing/` directory.  
**Special considerations:** Ensure the module is not accidentally included in production classpaths. Verify that `<scope>test</scope>` is declared in all consuming modules.

#### 1.3.G — Shared Library

A Shared Library is a `jar`-packaged module with no main class, consumed by multiple other modules in compile or runtime scope. It encapsulates reusable business logic, utilities, or cross-cutting concerns.

**Mandatory SOP sections:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13  
**Key characteristics:** High-impact changes require careful backward-compatibility analysis; semantic versioning is especially important; may be consumed by modules outside the monorepo via Artifactory.  
**Special considerations:** If the library is consumed by external teams via Artifactory, the monorepo migration must not break the published artifact coordinates. The `deploy` lifecycle must remain active for these modules.

#### 1.3.H — Legacy Web Application

A Legacy Web Application has `<packaging>war</packaging>` or `<packaging>ear</packaging>` and is deployed to an application server such as Tomcat, JBoss, or WebSphere.

**Mandatory SOP sections:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13  
**Key characteristics:** May have complex assembly configurations; may have server-specific deployment descriptors; container image building may require a custom base image with the application server.  
**Special considerations:** Consider whether containerisation is part of the migration scope. If so, a custom Jib base image or a Dockerfile-based approach may be required.

#### 1.3.I — Maven Plugin Module

A Maven Plugin Module produces a Maven plugin artifact. It has `<packaging>maven-plugin</packaging>` and uses `maven-plugin-plugin` for descriptor generation.

**Mandatory SOP sections:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13  
**Key characteristics:** Plugin integration tests use `maven-invoker-plugin`; plugin descriptor generation requires `maven-plugin-plugin`; the plugin must be installed before it can be used in the same reactor build.  
**Special considerations:** Plugin modules must be placed early in the reactor build order. Use `<extensions>true</extensions>` only when the plugin extends the Maven lifecycle.

### 1.4 Target Location Determination

The monorepo hierarchy follows the pattern: **Organisation → Suite → Product → Subsystem → Module**. Use the following matrix to determine where the module belongs.

| Module Characteristic | Target Hierarchy Level | Example Path |
|----------------------|------------------------|--------------|
| Used by 3+ products across 2+ suites | `shared/` | `shared/common-security/` |
| Used by 2+ products within one suite | `suite-a/shared/` | `suite-a/shared/suite-a-utils/` |
| Core business logic of one product | `suite-a/product-x/` | `suite-a/product-x/product-x-service/` |
| API contracts for one product | `suite-a/product-x/` | `suite-a/product-x/product-x-api/` |
| Data access layer of one product | `suite-a/product-x/` | `suite-a/product-x/product-x-data/` |
| Deployable application of one product | `suite-a/product-x/` | `suite-a/product-x/product-x-app/` |
| Test utilities for one product | `suite-a/product-x/` | `suite-a/product-x/product-x-test-support/` |
| Generated code for one product | `suite-a/product-x/` | `suite-a/product-x/product-x-generated/` |
| Suite-level parent POM | `suite-a/` | `suite-a/pom.xml` |
| Root parent POM | Root | `pom.xml` |

### 1.5 Key Refactoring Requirements Summary

After completing the discovery questionnaire and module classification, compile the following summary table. This table becomes the working reference for all subsequent sections.

| Requirement | Applicable? | Notes |
|-------------|-------------|-------|
| Parent POM hierarchy setup | Yes/No | Which level(s) need new parent POMs? |
| Artifactory dependency conversion | Yes/No | List affected `groupId:artifactId` pairs |
| Circular dependency resolution | Yes/No | List the cycle participants |
| Code generation plugin migration | Yes/No | Which tool: protobuf / OpenAPI / JAXB / WSDL? |
| Jib container image configuration | Yes/No | Target registry and base image |
| CI/CD pipeline creation | Yes/No | Which CI system? |
| SBOM generation setup | Yes/No | CycloneDX or SPDX format? |
| Security scanning integration | Yes/No | SAST / dependency / container / DAST |
| Integration test configuration | Yes/No | Failsafe plugin required? |
| Environment-specific configuration | Yes/No | Which environments: dev / test / staging / prod? |
| Compliance/audit requirements | Yes/No | Regulatory framework (SOC2, PCI-DSS, HIPAA, etc.) |
| External Artifactory publishing | Yes/No | Consumed by teams outside the monorepo? |

---

## 2. Directory Structure Setup

This section defines the canonical directory layout for the monorepo and specifies where each module type must be placed. Consistency in directory structure is essential for build tooling, IDE support, and developer orientation.

### 2.1 Monorepo Root Layout

The following structure represents the complete monorepo skeleton. Every module migrated into the repository must fit within this hierarchy.

```
monorepo/
├── .mvn/
│   ├── extensions.xml          # Maven Build Cache Extension registration
│   └── maven.config            # Default Maven CLI flags for all builds
├── .github/
│   └── workflows/              # GitHub Actions CI/CD workflow definitions
├── docs/
│   ├── architecture/           # System-level architecture diagrams (C4, PlantUML)
│   ├── adr/                    # Architecture Decision Records
│   └── operations/             # Operational runbooks and incident response guides
├── shared/
│   ├── pom.xml                 # Shared libraries parent POM
│   ├── common-bom/             # Bill of Materials for third-party dependency versions
│   ├── common-utils/           # General-purpose utility library
│   ├── common-security/        # Cross-cutting security utilities
│   ├── common-observability/   # Metrics, tracing, and logging abstractions
│   └── common-testing/         # Shared test utilities and fixtures
├── suite-a/
│   ├── pom.xml                 # Suite-A parent POM
│   ├── shared/
│   │   └── suite-a-domain/     # Suite-A shared domain model
│   ├── product-x/
│   │   ├── pom.xml             # Product-X parent POM
│   │   ├── product-x-api/      # API contracts (OpenAPI specs, protobuf, DTOs)
│   │   ├── product-x-service/  # Business logic and domain services
│   │   ├── product-x-data/     # Data access layer (JPA repositories, etc.)
│   │   ├── product-x-app/      # Deployable Spring Boot application
│   │   └── product-x-it/       # Integration tests for Product-X
│   └── product-y/
│       └── ...
├── suite-b/
│   └── ...
└── pom.xml                     # Root parent POM (reactor root)
```

### 2.2 Standard Module Internal Layout

Every module, regardless of type, must follow the Maven Standard Directory Layout[^1] internally. The table below maps each directory to its purpose.

| Directory | Purpose | Notes |
|-----------|---------|-------|
| `src/main/java` | Production Java source code | Package structure mirrors `groupId.artifactId` |
| `src/main/resources` | Production resources (properties, YAML, XML) | Environment-specific files use Spring profiles |
| `src/main/proto` | Protocol Buffer definition files | For protobuf modules only |
| `src/main/resources/api/` | OpenAPI specification files | For OpenAPI generator modules |
| `src/main/resources/xsd/` | XML Schema Definition files | For JAXB modules |
| `src/main/resources/wsdl/` | WSDL files | For JAX-WS modules |
| `src/test/java` | Test source code | Unit tests only; integration tests go in `*-it` module |
| `src/test/resources` | Test resources | Test-specific configuration |
| `target/` | Build output directory | Must be in `.gitignore` |
| `target/generated-sources/` | Generated Java sources | Must be in `.gitignore`; never committed |

### 2.3 Module Placement by Type

#### 2.3.1 Shared Libraries

Shared libraries that are consumed across multiple product suites belong under `shared/`. Libraries consumed only within a single suite belong under `suite-name/shared/`.

```
shared/
├── pom.xml
├── common-bom/
│   └── pom.xml                 # <packaging>pom</packaging>; only <dependencyManagement>
├── common-utils/
│   ├── pom.xml
│   └── src/main/java/com/company/common/utils/
├── common-security/
│   ├── pom.xml
│   └── src/main/java/com/company/common/security/
└── common-testing/
    ├── pom.xml
    └── src/
        ├── main/java/com/company/common/testing/  # Test support classes
        └── test/java/                              # Self-tests for the test utilities
```

#### 2.3.2 Deployable Microservices

Deployable microservices belong under their product directory. The application module (`*-app`) is the deployable unit; it depends on the service and data modules.

```
suite-a/product-x/
├── pom.xml                             # Product-X parent POM
├── product-x-api/                      # API contracts; no main class
│   ├── pom.xml
│   └── src/main/
│       ├── java/                       # DTOs, interfaces, exceptions
│       └── resources/api/product-x.yaml  # OpenAPI spec
├── product-x-service/                  # Business logic; no main class
│   ├── pom.xml
│   └── src/main/java/
├── product-x-data/                     # Data access; no main class
│   ├── pom.xml
│   └── src/main/java/
├── product-x-app/                      # Spring Boot application; has main class
│   ├── pom.xml                         # Jib plugin configured here
│   └── src/main/
│       ├── java/com/company/productx/ProductXApplication.java
│       └── resources/
│           ├── application.yml
│           ├── application-dev.yml
│           ├── application-test.yml
│           └── application-prod.yml
└── product-x-it/                       # Integration tests; separate module
    ├── pom.xml                         # Failsafe plugin configured here
    └── src/test/java/
```

#### 2.3.3 Generated Code Modules

Generated code modules contain only schema source files and the plugin configuration to process them. The generated Java sources are produced at build time and must never be committed to version control.

```
suite-a/product-x/product-x-generated/
├── pom.xml                             # Code generation plugin configured here
├── src/main/
│   ├── proto/                          # For protobuf: *.proto files
│   │   └── com/company/productx/
│   │       ├── service.proto
│   │       └── model.proto
│   └── resources/
│       ├── api/                        # For OpenAPI: *.yaml files
│       │   └── product-x-api.yaml
│       └── xsd/                        # For JAXB: *.xsd files
│           └── product-x-schema.xsd
└── target/
    └── generated-sources/              # NEVER committed; produced at build time
        ├── protobuf/
        ├── openapi/
        └── jaxb/
```

The `.gitignore` at the module root must include:

```gitignore
target/
!.mvn/wrapper/maven-wrapper.jar
```

#### 2.3.4 Parent POM Modules

Parent POM modules have no `src/` directory. Their entire content is the `pom.xml` file.

```
suite-a/
├── pom.xml                             # Suite-A parent POM; <packaging>pom</packaging>
└── product-x/
    └── pom.xml                         # Product-X parent POM; <packaging>pom</packaging>
```

#### 2.3.5 Documentation Placement

Documentation must be co-located with the code it describes, following a layered approach.

| Documentation Type | Location | Format |
|-------------------|----------|--------|
| Module-level README | `module-name/README.md` | Markdown |
| Module API documentation | `module-name/docs/` | Markdown or AsciiDoc |
| Product-level architecture | `suite-a/product-x/docs/architecture/` | PlantUML, C4, or Mermaid |
| Product-level runbook | `suite-a/product-x/docs/runbooks/` | Markdown |
| Suite-level documentation | `suite-a/docs/` | Markdown |
| System-level architecture | `docs/architecture/` | PlantUML, C4, or Mermaid |
| Architecture Decision Records | `docs/adr/` | Markdown (ADR format) |

### 2.4 Naming Conventions

Consistent naming prevents ambiguity and enables tooling automation. The following conventions are mandatory.

| Element | Convention | Example |
|---------|------------|---------|
| Directory names | `kebab-case` | `product-x-service/` |
| Maven `artifactId` | `kebab-case`, matches directory name | `product-x-service` |
| Maven `groupId` | `com.company.suite.product` | `com.company.suitea.productx` |
| Java package | Mirrors `groupId` | `com.company.suitea.productx.service` |
| Integration test module | `{product}-it` | `product-x-it` |
| Generated code module | `{product}-generated` | `product-x-generated` |
| Test utility module | `{product}-test-support` | `product-x-test-support` |
| Application module | `{product}-app` | `product-x-app` |

---

## 3. POM.XML Refactoring

This section provides exact POM.XML configurations for every module type. Work through the subsections that apply to the module being migrated, as determined by the assessment in Section 1.

### 3.1 Root Parent POM

The root `pom.xml` is the single most important file in the monorepo. It defines the reactor, manages all third-party dependency versions, and configures all build plugins. Every module in the monorepo inherits from this POM, directly or transitively.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
             https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.company</groupId>
    <artifactId>monorepo-root</artifactId>
    <!-- CI-friendly version: override with -Drevision=X.Y.Z on CLI -->
    <version>${revision}${changelist}</version>
    <packaging>pom</packaging>
    <name>Company Monorepo Root</name>

    <properties>
        <!-- CI-friendly versioning (Maven 3.5+) -->
        <revision>0.0.1</revision>
        <changelist>-SNAPSHOT</changelist>

        <!-- Java version -->
        <java.version>17</java.version>
        <maven.compiler.source>${java.version}</maven.compiler.source>
        <maven.compiler.target>${java.version}</maven.compiler.target>
        <maven.compiler.release>${java.version}</maven.compiler.release>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <project.reporting.outputEncoding>UTF-8</project.reporting.outputEncoding>

        <!-- Third-party dependency versions (single source of truth) -->
        <spring-boot.version>3.3.4</spring-boot.version>
        <spring-cloud.version>2023.0.3</spring-cloud.version>
        <grpc.version>1.67.1</grpc.version>
        <protobuf.version>3.25.5</protobuf.version>
        <jackson.version>2.17.2</jackson.version>
        <slf4j.version>2.0.16</slf4j.version>
        <junit.version>5.11.2</junit.version>
        <mockito.version>5.14.1</mockito.version>
        <testcontainers.version>1.20.2</testcontainers.version>

        <!-- Plugin versions -->
        <maven-compiler-plugin.version>3.13.0</maven-compiler-plugin.version>
        <maven-surefire-plugin.version>3.5.1</maven-surefire-plugin.version>
        <maven-failsafe-plugin.version>3.5.1</maven-failsafe-plugin.version>
        <maven-enforcer-plugin.version>3.5.0</maven-enforcer-plugin.version>
        <flatten-maven-plugin.version>1.6.0</flatten-maven-plugin.version>
        <jib-maven-plugin.version>3.5.1</jib-maven-plugin.version>
        <cyclonedx-maven-plugin.version>2.9.0</cyclonedx-maven-plugin.version>
        <git-commit-id-plugin.version>9.0.1</git-commit-id-plugin.version>
        <jacoco-maven-plugin.version>0.8.12</jacoco-maven-plugin.version>
        <spotbugs-maven-plugin.version>4.8.6.4</spotbugs-maven-plugin.version>
        <dependency-check-maven.version>11.1.0</dependency-check-maven.version>

        <!-- Build behaviour flags -->
        <maven.deploy.skip>true</maven.deploy.skip>   <!-- Override in deployable modules -->
        <maven.install.skip>false</maven.install.skip>
        <skipITs>true</skipITs>                        <!-- Override in CI with -DskipITs=false -->
    </properties>

    <modules>
        <module>shared</module>
        <module>suite-a</module>
        <module>suite-b</module>
        <!-- Add new suites here -->
    </modules>

    <dependencyManagement>
        <dependencies>
            <!-- Import Spring Boot BOM -->
            <dependency>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-dependencies</artifactId>
                <version>${spring-boot.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
            <!-- Import Spring Cloud BOM -->
            <dependency>
                <groupId>org.springframework.cloud</groupId>
                <artifactId>spring-cloud-dependencies</artifactId>
                <version>${spring-cloud.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
            <!-- Internal shared modules -->
            <dependency>
                <groupId>com.company</groupId>
                <artifactId>common-utils</artifactId>
                <version>${project.version}</version>
            </dependency>
            <dependency>
                <groupId>com.company</groupId>
                <artifactId>common-security</artifactId>
                <version>${project.version}</version>
            </dependency>
            <dependency>
                <groupId>com.company</groupId>
                <artifactId>common-testing</artifactId>
                <version>${project.version}</version>
                <scope>test</scope>
            </dependency>
            <!-- Add all internal modules here as they are migrated -->
        </dependencies>
    </dependencyManagement>

    <build>
        <pluginManagement>
            <plugins>
                <plugin>
                    <groupId>org.apache.maven.plugins</groupId>
                    <artifactId>maven-compiler-plugin</artifactId>
                    <version>${maven-compiler-plugin.version}</version>
                    <configuration>
                        <release>${java.version}</release>
                        <parameters>true</parameters>
                    </configuration>
                </plugin>
                <plugin>
                    <groupId>org.apache.maven.plugins</groupId>
                    <artifactId>maven-surefire-plugin</artifactId>
                    <version>${maven-surefire-plugin.version}</version>
                    <configuration>
                        <argLine>@{argLine} -Xmx512m</argLine>
                        <forkCount>1</forkCount>
                        <reuseForks>true</reuseForks>
                    </configuration>
                </plugin>
                <plugin>
                    <groupId>org.apache.maven.plugins</groupId>
                    <artifactId>maven-failsafe-plugin</artifactId>
                    <version>${maven-failsafe-plugin.version}</version>
                    <configuration>
                        <skipITs>${skipITs}</skipITs>
                    </configuration>
                    <executions>
                        <execution>
                            <goals>
                                <goal>integration-test</goal>
                                <goal>verify</goal>
                            </goals>
                        </execution>
                    </executions>
                </plugin>
                <plugin>
                    <groupId>org.apache.maven.plugins</groupId>
                    <artifactId>maven-enforcer-plugin</artifactId>
                    <version>${maven-enforcer-plugin.version}</version>
                    <executions>
                        <execution>
                            <id>enforce-rules</id>
                            <goals>
                                <goal>enforce</goal>
                            </goals>
                            <configuration>
                                <rules>
                                    <requireMavenVersion>
                                        <version>[3.9.0,)</version>
                                    </requireMavenVersion>
                                    <requireJavaVersion>
                                        <version>[17,)</version>
                                    </requireJavaVersion>
                                    <dependencyConvergence/>
                                    <banDuplicatePomDependencyVersions/>
                                </rules>
                            </configuration>
                        </execution>
                    </executions>
                </plugin>
                <plugin>
                    <groupId>org.codehaus.mojo</groupId>
                    <artifactId>flatten-maven-plugin</artifactId>
                    <version>${flatten-maven-plugin.version}</version>
                    <configuration>
                        <updatePomFile>true</updatePomFile>
                        <flattenMode>resolveCiFriendlyVersions</flattenMode>
                    </configuration>
                    <executions>
                        <execution>
                            <id>flatten</id>
                            <phase>process-resources</phase>
                            <goals>
                                <goal>flatten</goal>
                            </goals>
                        </execution>
                        <execution>
                            <id>flatten.clean</id>
                            <phase>clean</phase>
                            <goals>
                                <goal>clean</goal>
                            </goals>
                        </execution>
                    </executions>
                </plugin>
                <plugin>
                    <groupId>org.jacoco</groupId>
                    <artifactId>jacoco-maven-plugin</artifactId>
                    <version>${jacoco-maven-plugin.version}</version>
                    <executions>
                        <execution>
                            <id>prepare-agent</id>
                            <goals>
                                <goal>prepare-agent</goal>
                            </goals>
                        </execution>
                        <execution>
                            <id>report</id>
                            <phase>verify</phase>
                            <goals>
                                <goal>report</goal>
                            </goals>
                        </execution>
                    </executions>
                </plugin>
                <plugin>
                    <groupId>com.google.cloud.tools</groupId>
                    <artifactId>jib-maven-plugin</artifactId>
                    <version>${jib-maven-plugin.version}</version>
                    <!-- Configured per deployable module; skip by default -->
                    <configuration>
                        <skip>true</skip>
                    </configuration>
                </plugin>
                <plugin>
                    <groupId>org.cyclonedx</groupId>
                    <artifactId>cyclonedx-maven-plugin</artifactId>
                    <version>${cyclonedx-maven-plugin.version}</version>
                </plugin>
            </plugins>
        </pluginManagement>

        <plugins>
            <!-- Flatten plugin must run in every module for CI-friendly versions -->
            <plugin>
                <groupId>org.codehaus.mojo</groupId>
                <artifactId>flatten-maven-plugin</artifactId>
            </plugin>
            <!-- Enforcer runs in every module -->
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-enforcer-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

### 3.2 Suite-Level and Product-Level Parent POMs

Suite and product parent POMs inherit from the root and add suite- or product-specific configuration. They must not duplicate properties or plugin versions already defined in the root POM.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
             https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>com.company</groupId>
        <artifactId>monorepo-root</artifactId>
        <version>${revision}${changelist}</version>
        <relativePath>../../pom.xml</relativePath>  <!-- Adjust depth as needed -->
    </parent>

    <groupId>com.company.suitea</groupId>
    <artifactId>suite-a-parent</artifactId>
    <packaging>pom</packaging>
    <name>Suite A Parent</name>

    <modules>
        <module>shared</module>
        <module>product-x</module>
        <module>product-y</module>
    </modules>

    <!-- Suite-specific dependency management goes here -->
    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>com.company.suitea</groupId>
                <artifactId>suite-a-domain</artifactId>
                <version>${project.version}</version>
            </dependency>
        </dependencies>
    </dependencyManagement>
</project>
```

### 3.3 Child Module POM Templates

#### 3.3.1 Shared Library

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0" ...>
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>com.company</groupId>
        <artifactId>shared-parent</artifactId>
        <version>${revision}${changelist}</version>
        <relativePath>../pom.xml</relativePath>
    </parent>

    <artifactId>common-utils</artifactId>
    <!-- No <version> needed; inherited from parent via ${revision}${changelist} -->
    <name>Common Utilities</name>

    <!-- Override deploy skip: shared libraries ARE published to Artifactory -->
    <properties>
        <maven.deploy.skip>false</maven.deploy.skip>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.slf4j</groupId>
            <artifactId>slf4j-api</artifactId>
            <!-- No version: managed in root parent dependencyManagement -->
        </dependency>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>
```

#### 3.3.2 Deployable Microservice Application Module

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0" ...>
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>com.company.suitea.productx</groupId>
        <artifactId>product-x-parent</artifactId>
        <version>${revision}${changelist}</version>
        <relativePath>../pom.xml</relativePath>
    </parent>

    <artifactId>product-x-app</artifactId>
    <name>Product X Application</name>

    <properties>
        <!-- Enable deployment for this deployable artifact -->
        <maven.deploy.skip>false</maven.deploy.skip>
        <!-- Container registry (injected by CI environment) -->
        <container.registry>${env.CONTAINER_REGISTRY}</container.registry>
        <!-- Base image for container -->
        <jib.from.image>eclipse-temurin:17-jre-alpine</jib.from.image>
    </properties>

    <dependencies>
        <dependency>
            <groupId>com.company.suitea.productx</groupId>
            <artifactId>product-x-service</artifactId>
            <!-- No version: managed in product-x parent dependencyManagement -->
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <executions>
                    <execution>
                        <goals>
                            <goal>repackage</goal>
                        </goals>
                    </execution>
                </executions>
            </plugin>
            <plugin>
                <groupId>com.google.cloud.tools</groupId>
                <artifactId>jib-maven-plugin</artifactId>
                <configuration>
                    <skip>false</skip>   <!-- Override root default -->
                    <from>
                        <image>${jib.from.image}</image>
                    </from>
                    <to>
                        <image>${container.registry}/${project.artifactId}</image>
                        <tags>
                            <tag>${project.version}</tag>
                            <tag>latest</tag>
                        </tags>
                    </to>
                    <container>
                        <jvmFlags>
                            <jvmFlag>-XX:+UseContainerSupport</jvmFlag>
                            <jvmFlag>-XX:MaxRAMPercentage=75.0</jvmFlag>
                            <jvmFlag>-Djava.security.egd=file:/dev/./urandom</jvmFlag>
                        </jvmFlags>
                        <ports>
                            <port>8080</port>
                        </ports>
                        <labels>
                            <org.opencontainers.image.version>${project.version}</org.opencontainers.image.version>
                            <org.opencontainers.image.revision>${git.commit.id}</org.opencontainers.image.revision>
                            <org.opencontainers.image.created>${git.build.time}</org.opencontainers.image.created>
                        </labels>
                    </container>
                </configuration>
            </plugin>
            <plugin>
                <groupId>io.github.git-commit-id</groupId>
                <artifactId>git-commit-id-maven-plugin</artifactId>
                <version>${git-commit-id-plugin.version}</version>
                <executions>
                    <execution>
                        <id>get-the-git-infos</id>
                        <goals>
                            <goal>revision</goal>
                        </goals>
                        <phase>initialize</phase>
                    </execution>
                </executions>
                <configuration>
                    <generateGitPropertiesFile>true</generateGitPropertiesFile>
                    <generateGitPropertiesFilename>
                        ${project.build.outputDirectory}/git.properties
                    </generateGitPropertiesFilename>
                    <includeOnlyProperties>
                        <includeOnlyProperty>git.commit.id</includeOnlyProperty>
                        <includeOnlyProperty>git.commit.time</includeOnlyProperty>
                        <includeOnlyProperty>git.branch</includeOnlyProperty>
                        <includeOnlyProperty>git.build.version</includeOnlyProperty>
                        <includeOnlyProperty>git.build.time</includeOnlyProperty>
                    </includeOnlyProperties>
                    <commitIdGenerationMode>full</commitIdGenerationMode>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

### 3.4 Converting Artifactory Dependencies to Direct Module References

This is the most common transformation performed during monorepo migration. The procedure converts a version-pinned Artifactory dependency into a version-managed direct module reference.

**Step 1:** Identify all internal dependencies. Run the following command in the source repository:

```bash
mvn dependency:list -DincludeGroupIds=com.company | grep -v "test" | sort -u
```

**Step 2:** For each internal dependency, locate its module in the monorepo. If the module has not yet been migrated, it must be migrated first or temporarily retained in Artifactory.

**Step 3:** Apply the following transformation to each internal dependency in `pom.xml`:

```xml
<!-- BEFORE: Version-pinned Artifactory dependency -->
<dependency>
    <groupId>com.company</groupId>
    <artifactId>common-utils</artifactId>
    <version>2.1.4</version>
</dependency>

<!-- AFTER: Version-managed direct module reference -->
<dependency>
    <groupId>com.company</groupId>
    <artifactId>common-utils</artifactId>
    <!-- Version removed; managed in parent <dependencyManagement> -->
</dependency>
```

**Step 4:** Add the dependency to the appropriate parent POM's `<dependencyManagement>` section if it is not already present:

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.company</groupId>
            <artifactId>common-utils</artifactId>
            <version>${project.version}</version>
        </dependency>
    </dependencies>
</dependencyManagement>
```

**Step 5:** Remove any `<repositories>` or `<pluginRepositories>` entries that point to Artifactory for internal artifacts. External dependencies (third-party libraries) may still require Artifactory as a proxy, but this should be configured in `settings.xml`, not in the POM.

### 3.5 CI-Friendly Versioning Setup

The monorepo uses Maven CI-friendly versions[^2] to manage the version across all modules from a single property. This eliminates the need for the `maven-release-plugin` and enables atomic versioning of the entire monorepo.

The `.mvn/maven.config` file at the repository root sets the default version for local development:

```
-Drevision=0.0.1
-Dchangelist=-SNAPSHOT
```

During CI builds, the version is overridden on the command line:

```bash
# Snapshot build
mvn clean install -Drevision=1.2.3 -Dchangelist=-SNAPSHOT

# Release build
mvn clean deploy -Drevision=1.2.3 -Dchangelist=
```

The `flatten-maven-plugin` must be configured in the root POM (see Section 3.1) to resolve the `${revision}` and `${changelist}` placeholders in published POM files, ensuring that consumers of published artifacts see concrete version numbers rather than unresolved property references[^3].

### 3.6 Code Generation Plugin Configurations

#### 3.6.1 Protocol Buffers (gRPC)

```xml
<build>
    <extensions>
        <!-- Required for os-maven-plugin to detect platform for protoc binary -->
        <extension>
            <groupId>kr.motd.maven</groupId>
            <artifactId>os-maven-plugin</artifactId>
            <version>1.7.1</version>
        </extension>
    </extensions>
    <plugins>
        <plugin>
            <groupId>org.xolstice.maven.plugins</groupId>
            <artifactId>protobuf-maven-plugin</artifactId>
            <version>0.6.1</version>
            <configuration>
                <protocArtifact>
                    com.google.protobuf:protoc:${protobuf.version}:exe:${os.detected.classifier}
                </protocArtifact>
                <pluginId>grpc-java</pluginId>
                <pluginArtifact>
                    io.grpc:protoc-gen-grpc-java:${grpc.version}:exe:${os.detected.classifier}
                </pluginArtifact>
                <checkStaleness>true</checkStaleness>
            </configuration>
            <executions>
                <execution>
                    <goals>
                        <goal>compile</goal>
                        <goal>compile-custom</goal>
                        <goal>test-compile</goal>
                        <goal>test-compile-custom</goal>
                    </goals>
                </execution>
            </executions>
        </plugin>
    </plugins>
</build>
```

#### 3.6.2 OpenAPI Generator

```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.openapitools</groupId>
            <artifactId>openapi-generator-maven-plugin</artifactId>
            <version>7.19.0</version>
            <executions>
                <execution>
                    <id>generate-server-stubs</id>
                    <goals>
                        <goal>generate</goal>
                    </goals>
                    <configuration>
                        <inputSpec>
                            ${project.basedir}/src/main/resources/api/product-x-api.yaml
                        </inputSpec>
                        <generatorName>spring</generatorName>
                        <output>${project.build.directory}/generated-sources/openapi</output>
                        <apiPackage>com.company.productx.api</apiPackage>
                        <modelPackage>com.company.productx.model</modelPackage>
                        <configOptions>
                            <interfaceOnly>true</interfaceOnly>
                            <useSpringBoot3>true</useSpringBoot3>
                            <useTags>true</useTags>
                            <dateLibrary>java8</dateLibrary>
                        </configOptions>
                        <skipIfSpecIsUnchanged>true</skipIfSpecIsUnchanged>
                    </configuration>
                </execution>
            </executions>
        </plugin>
    </plugins>
</build>
```

#### 3.6.3 JAXB (XSD to Java)

```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.jvnet.jaxb</groupId>
            <artifactId>jaxb-maven-plugin</artifactId>
            <version>4.0.8</version>
            <executions>
                <execution>
                    <id>generate-jaxb-sources</id>
                    <goals>
                        <goal>generate</goal>
                    </goals>
                </execution>
            </executions>
            <configuration>
                <schemaDirectory>${project.basedir}/src/main/resources/xsd</schemaDirectory>
                <generateDirectory>${project.build.directory}/generated-sources/jaxb</generateDirectory>
                <generatePackage>com.company.productx.generated.model</generatePackage>
                <strict>true</strict>
            </configuration>
        </plugin>
    </plugins>
</build>
```

---

## 4. Dependency Resolution

This section provides a systematic procedure for identifying, converting, and validating all dependency relationships for a module being migrated.

### 4.1 Identifying Internal Dependencies

Internal dependencies are those with a `groupId` matching the company namespace (e.g., `com.company.*`). Execute the following commands to enumerate them:

```bash
# List all compile and runtime internal dependencies
mvn dependency:list -DincludeGroupIds=com.company \
    -DexcludeClassifiers=test \
    -DoutputFile=internal-deps.txt

# Display the full dependency tree including transitive dependencies
mvn dependency:tree -Dverbose -DoutputFile=dependency-tree.txt

# Identify unused declared dependencies and undeclared used dependencies
mvn dependency:analyze
```

Review `internal-deps.txt` and categorise each dependency:

| Category | Description | Action |
|----------|-------------|--------|
| Already in monorepo | Module has been migrated | Convert to direct reference (Section 4.2) |
| Not yet in monorepo | Module still in Artifactory | Migrate that module first, or retain Artifactory reference temporarily |
| External team module | Owned by another team; published to Artifactory | Retain Artifactory reference; coordinate with owning team |
| Third-party library | Not a company module | Retain as-is; ensure version is in root `<dependencyManagement>` |

### 4.2 Converting Registry-Based to Direct Module References

For each internal dependency that has already been migrated to the monorepo, perform the following conversion:

**Step 1:** Remove the `<version>` element from the dependency declaration in the child module's `pom.xml`.

**Step 2:** Ensure the dependency is declared in the nearest applicable parent POM's `<dependencyManagement>` section with `<version>${project.version}</version>`.

**Step 3:** Verify the dependency's module is listed (directly or transitively) in the reactor. Run `mvn help:evaluate -Dexpression=project.modules` at the appropriate parent level to confirm.

**Step 4:** Remove any Artifactory repository declarations for internal artifacts from the module's `pom.xml`. Repository configuration for external dependencies should live in `settings.xml` or the root POM's `<repositories>` section.

### 4.3 Detecting and Resolving Circular Dependencies

Maven does not support circular dependencies between modules. If a circular dependency is detected, the build will fail with an error such as `[ERROR] The projects in the reactor contain a cyclic reference`. Detect potential cycles before migration:

```bash
# Run from the module directory
mvn dependency:tree -Dverbose 2>&1 | grep -i "cycle\|circular"
```

**Resolution Strategy:**

When Module A depends on Module B and Module B depends on Module A, the standard resolution is to extract the shared contract into a new Module C:

```
BEFORE:                    AFTER:
  A ──► B                    A ──► C ◄── B
  B ──► A                    (C contains the shared interface/contract)
```

The practical steps are:

1. Identify the classes or interfaces that cause the cycle (typically shared interfaces, events, or DTOs).
2. Create a new `*-api` or `*-contracts` module containing only those shared types.
3. Update Module A and Module B to depend on the new contracts module instead of each other.
4. Verify the cycle is resolved: `mvn validate` should succeed without cycle errors.

### 4.4 Handling Version Conflicts

Version conflicts occur when two or more modules in the dependency tree require different versions of the same transitive dependency. The Maven enforcer plugin's `dependencyConvergence` rule[^4] will fail the build when conflicts are detected.

**Detection:**

```bash
mvn dependency:tree -Dverbose -Dincludes=org.slf4j:slf4j-api
```

The output will show all paths through the dependency tree that lead to different versions of the artifact.

**Resolution options, in order of preference:**

1. **Managed version in parent POM:** Add the conflicting dependency to the root `<dependencyManagement>` with the desired version. Maven will use this version for all transitive occurrences.

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.slf4j</groupId>
            <artifactId>slf4j-api</artifactId>
            <version>2.0.16</version>  <!-- Pins version across all transitive deps -->
        </dependency>
    </dependencies>
</dependencyManagement>
```

2. **Exclusion:** If a specific transitive dependency must be excluded from a particular path, use `<exclusions>`:

```xml
<dependency>
    <groupId>org.jdom</groupId>
    <artifactId>jdom</artifactId>
    <version>1.1.3</version>
    <exclusions>
        <exclusion>
            <groupId>jaxen</groupId>
            <artifactId>jaxen</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```

3. **BOM import:** If the conflicting dependencies belong to a coherent framework (e.g., Spring, Quarkus), import the framework's BOM in `<dependencyManagement>` to align all versions at once.

### 4.5 Managing Transitive Dependencies

Transitive dependencies should not be declared explicitly unless they are directly used in the module's source code. Use `mvn dependency:analyze` to identify:

- **Used and undeclared:** Dependencies that are used in source code but not declared in `pom.xml`. These must be added as explicit dependencies.
- **Declared but unused:** Dependencies declared in `pom.xml` but not used in source code. These should be removed unless they are required at runtime (e.g., JDBC drivers, logging implementations).

```bash
# Analyse dependency usage
mvn dependency:analyze -DfailOnWarning=false -DoutputXML=true
```

---

## 5. Build Configuration

This section covers build performance optimisation, caching, parallel execution, and module-type-specific build configurations.

### 5.1 Maven Build Cache Extension

The Maven Build Cache Extension[^5] enables local and remote caching of build outputs, dramatically reducing build times for unchanged modules. Configure it by creating `.mvn/extensions.xml` at the monorepo root:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<extensions>
    <extension>
        <groupId>org.apache.maven.extensions</groupId>
        <artifactId>maven-build-cache-extension</artifactId>
        <version>1.2.0</version>
    </extension>
</extensions>
```

Create `.mvn/maven-build-cache-config.xml` to configure cache behaviour:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<cache xmlns="http://maven.apache.org/BUILD-CACHE-CONFIG/1.0.0"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://maven.apache.org/BUILD-CACHE-CONFIG/1.0.0
           https://maven.apache.org/xsd/build-cache-config-1.0.0.xsd">
    <configuration>
        <enabled>true</enabled>
        <hashAlgorithm>SHA-256</hashAlgorithm>
        <validateXml>true</validateXml>
        <remote>
            <enabled>${env.MAVEN_CACHE_REMOTE_ENABLED}</enabled>
            <url>${env.MAVEN_CACHE_REMOTE_URL}</url>
        </remote>
        <local>
            <maxBuildsCached>3</maxBuildsCached>
        </local>
    </configuration>
    <input>
        <global>
            <glob>
                <pattern>src/**</pattern>
            </glob>
            <glob>
                <pattern>pom.xml</pattern>
            </glob>
        </global>
    </input>
</cache>
```

### 5.2 Parallel Build Configuration

Maven supports parallel builds via the `-T` flag. The optimal thread count depends on the machine's core count and the module dependency graph.

```bash
# Use 4 threads (suitable for 8-core machines)
mvn clean install -T 4

# Use 1 thread per CPU core (auto-detected)
mvn clean install -T 1C

# Use 75% of available cores (recommended for shared CI agents)
mvn clean install -T 0.75C
```

**Important constraints for parallel builds:**

- Modules with circular dependencies cannot be built in parallel (they must not exist after Section 4.3 is complete).
- Code generation modules must complete before modules that depend on their generated sources. Maven's reactor respects the dependency graph, so this is handled automatically when dependencies are declared correctly.
- Integration test modules that start external services (databases, message brokers) may require sequential execution to avoid port conflicts. Use `-T 1` for integration test runs or configure unique ports per module.

### 5.3 Memory and JVM Configuration

Set JVM options for the Maven process via the `MAVEN_OPTS` environment variable or the `.mvn/jvm.config` file:

```
# .mvn/jvm.config
-Xmx4g
-XX:+UseG1GC
-XX:+UseStringDeduplication
-XX:ReservedCodeCacheSize=512m
-Dfile.encoding=UTF-8
```

For machines with 32GB RAM, the following allocation is recommended:

| Resource | Recommended Setting | Rationale |
|----------|---------------------|-----------|
| Maven JVM heap | `-Xmx4g` | Sufficient for most builds; increase to 8g for very large modules |
| Surefire fork heap | `-Xmx512m` per fork | Prevents OOM in parallel test execution |
| Failsafe fork heap | `-Xmx1g` per fork | Integration tests typically require more memory |
| Parallel threads | `-T 1C` | Matches thread count to core count |

### 5.4 Build Profiles

Define Maven profiles for different build scenarios. Profiles are declared in the root POM and can be activated by property, environment, or explicit `-P` flag.

```xml
<profiles>
    <!-- Local development: fast build, skip integration tests and security scans -->
    <profile>
        <id>dev</id>
        <activation>
            <activeByDefault>true</activeByDefault>
        </activation>
        <properties>
            <skipITs>true</skipITs>
            <dependency-check.skip>true</dependency-check.skip>
            <spotbugs.skip>true</spotbugs.skip>
        </properties>
    </profile>

    <!-- CI build: full test suite, security scans, SBOM generation -->
    <profile>
        <id>ci</id>
        <activation>
            <property>
                <name>env.CI</name>
                <value>true</value>
            </property>
        </activation>
        <properties>
            <skipITs>false</skipITs>
            <dependency-check.skip>false</dependency-check.skip>
            <spotbugs.skip>false</spotbugs.skip>
        </properties>
    </profile>

    <!-- Release build: full validation, deployment, container image push -->
    <profile>
        <id>release</id>
        <properties>
            <skipITs>false</skipITs>
            <maven.deploy.skip>false</maven.deploy.skip>
            <jib.skip>false</jib.skip>
        </properties>
    </profile>

    <!-- Performance tests: run only performance test suite -->
    <profile>
        <id>perf-tests</id>
        <properties>
            <skipITs>false</skipITs>
            <surefire.excludes>**/*Test.java</surefire.excludes>
            <failsafe.includes>**/*PerfTest.java,**/*PerformanceTest.java</failsafe.includes>
        </properties>
    </profile>
</profiles>
```

### 5.5 Incremental Build Strategy

The incremental build strategy uses Maven's `-pl` (project list) and `-am`/`-amd` flags to build only the modules affected by a change.

```bash
# Build a specific module and all modules it depends on
mvn clean install -pl :product-x-app -am

# Build a specific module and all modules that depend on it
mvn clean install -pl :common-utils -amd

# Build multiple modules
mvn clean install -pl :product-x-service,:product-x-data -am

# Resume a failed build from a specific module
mvn clean install -rf :product-x-service
```

For CI pipelines, implement change detection to determine which modules need rebuilding. The following script identifies changed modules based on Git diff:

```bash
#!/bin/bash
# detect-changed-modules.sh
# Usage: ./detect-changed-modules.sh <base-ref> <head-ref>
BASE_REF=${1:-HEAD~1}
HEAD_REF=${2:-HEAD}

CHANGED_FILES=$(git diff --name-only "$BASE_REF" "$HEAD_REF")
CHANGED_MODULES=""

while IFS= read -r file; do
    dir=$(dirname "$file")
    while [ "$dir" != "." ] && [ "$dir" != "/" ]; do
        if [ -f "$dir/pom.xml" ]; then
            artifact=$(grep -oP '(?<=<artifactId>)[^<]+' "$dir/pom.xml" | head -1)
            if [ -n "$artifact" ]; then
                CHANGED_MODULES="$CHANGED_MODULES :$artifact"
            fi
            break
        fi
        dir=$(dirname "$dir")
    done
done <<< "$CHANGED_FILES"

# Deduplicate
CHANGED_MODULES=$(echo "$CHANGED_MODULES" | tr ' ' '\n' | sort -u | tr '\n' ',' | sed 's/,$//')
echo "$CHANGED_MODULES"
```

---

## 6. CI/CD Integration

This section covers the complete CI/CD pipeline configuration for the monorepo, including change detection, security scanning, SBOM generation, and deployment.

### 6.1 GitHub Actions Workflow Structure

The monorepo CI/CD pipeline uses a layered workflow structure. Each layer builds on the previous one and can be triggered independently.

```
.github/workflows/
├── ci.yml              # Triggered on every push/PR; builds changed modules
├── release.yml         # Triggered on release tags; full build, deploy, image push
├── security.yml        # Scheduled security scans (SAST, dependency check)
├── nightly.yml         # Nightly full build with integration tests
└── deploy.yml          # Manual deployment to specific environments
```

#### 6.1.1 CI Workflow (ci.yml)

```yaml
name: CI

on:
  push:
    branches: [main, develop, 'release/**']
  pull_request:
    branches: [main, develop]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      changed-modules: ${{ steps.detect.outputs.modules }}
      has-changes: ${{ steps.detect.outputs.has-changes }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Detect changed Maven modules
        id: detect
        run: |
          MODULES=$(./scripts/detect-changed-modules.sh ${{ github.event.before }} ${{ github.sha }})
          echo "modules=$MODULES" >> $GITHUB_OUTPUT
          echo "has-changes=$([ -n "$MODULES" ] && echo 'true' || echo 'false')" >> $GITHUB_OUTPUT

  build:
    needs: detect-changes
    if: needs.detect-changes.outputs.has-changes == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: 'maven'
      - name: Build changed modules and dependents
        run: |
          mvn clean install \
            -pl ${{ needs.detect-changes.outputs.changed-modules }} \
            -amd \
            -T 1C \
            -Drevision=${{ github.run_number }} \
            -Dchangelist=-SNAPSHOT \
            -DskipITs=false \
            -Pci \
            --batch-mode \
            --no-transfer-progress
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: '**/target/surefire-reports/**'
      - name: Upload coverage reports
        uses: actions/upload-artifact@v4
        with:
          name: coverage-reports
          path: '**/target/site/jacoco/**'
```

### 6.2 Security Scanning Integration

Security scanning must be integrated at multiple layers of the pipeline. The following table maps scan types to tools and pipeline stages.

| Scan Type | Tool | Pipeline Stage | Failure Policy |
|-----------|------|----------------|----------------|
| SAST (Static Analysis) | SpotBugs + Find Security Bugs | `verify` phase | Fail on HIGH severity |
| Dependency Vulnerability | OWASP Dependency-Check | `verify` phase | Fail on CVSS >= 7.0 |
| Container Image Scanning | Trivy (post-Jib build) | Post-build | Fail on CRITICAL |
| Secret Detection | Gitleaks | Pre-commit + CI | Fail on any finding |
| Infrastructure Scanning | Checkov (for Helm/Terraform) | CI | Fail on HIGH |

#### 6.2.1 OWASP Dependency-Check Configuration

```xml
<plugin>
    <groupId>org.owasp</groupId>
    <artifactId>dependency-check-maven</artifactId>
    <version>${dependency-check-maven.version}</version>
    <configuration>
        <failBuildOnCVSS>7</failBuildOnCVSS>
        <suppressionFile>${project.basedir}/dependency-check-suppressions.xml</suppressionFile>
        <nvdApiKey>${env.NVD_API_KEY}</nvdApiKey>
        <formats>
            <format>HTML</format>
            <format>JSON</format>
            <format>SARIF</format>
        </formats>
        <outputDirectory>${project.build.directory}/dependency-check-reports</outputDirectory>
    </configuration>
    <executions>
        <execution>
            <goals>
                <goal>check</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

#### 6.2.2 SpotBugs with Find Security Bugs

```xml
<plugin>
    <groupId>com.github.spotbugs</groupId>
    <artifactId>spotbugs-maven-plugin</artifactId>
    <version>${spotbugs-maven-plugin.version}</version>
    <configuration>
        <effort>Max</effort>
        <threshold>High</threshold>
        <failOnError>true</failOnError>
        <plugins>
            <plugin>
                <groupId>com.h3xstream.findsecbugs</groupId>
                <artifactId>findsecbugs-plugin</artifactId>
                <version>1.13.0</version>
            </plugin>
        </plugins>
        <excludeFilterFile>${project.basedir}/spotbugs-exclude.xml</excludeFilterFile>
    </configuration>
    <executions>
        <execution>
            <id>spotbugs-check</id>
            <phase>verify</phase>
            <goals>
                <goal>check</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

### 6.3 SBOM Generation

Software Bill of Materials (SBOM) generation uses the CycloneDX Maven plugin[^6]. Configure it in the root POM's `<pluginManagement>` and activate it in deployable modules.

```xml
<!-- In deployable module pom.xml -->
<plugin>
    <groupId>org.cyclonedx</groupId>
    <artifactId>cyclonedx-maven-plugin</artifactId>
    <executions>
        <execution>
            <id>generate-sbom</id>
            <phase>package</phase>
            <goals>
                <goal>makeAggregateBom</goal>
            </goals>
        </execution>
    </executions>
    <configuration>
        <projectType>application</projectType>
        <schemaVersion>1.5</schemaVersion>
        <includeBomSerialNumber>true</includeBomSerialNumber>
        <includeCompileScope>true</includeCompileScope>
        <includeProvidedScope>true</includeProvidedScope>
        <includeRuntimeScope>true</includeRuntimeScope>
        <includeSystemScope>true</includeSystemScope>
        <includeTestScope>false</includeTestScope>
        <includeLicenseText>false</includeLicenseText>
        <outputFormat>all</outputFormat>
        <outputName>bom</outputName>
    </configuration>
</plugin>
```

The SBOM output files (`bom.json`, `bom.xml`) are produced in `target/` and must be archived as CI artifacts and attached to GitHub Releases.

### 6.4 Artifact Attestation

For regulated environments, build provenance attestation provides cryptographic proof that an artifact was produced by a specific CI workflow. Use GitHub's `attest-build-provenance` action:

```yaml
- name: Attest build provenance
  uses: actions/attest-build-provenance@v1
  with:
    subject-path: |
      target/*.jar
      target/bom.json
```

---

## 7. Release Management Setup

### 7.1 Versioning Strategy

The monorepo supports two versioning strategies. Choose one based on the team's release cadence and consumer expectations.

| Strategy | Description | When to Use |
|----------|-------------|-------------|
| **Unified versioning** | All modules share the same version; a single version bump releases the entire monorepo | Tightly coupled suites; infrequent releases; simplest to manage |
| **Independent module versioning** | Each module has its own version managed via Git tags | Loosely coupled libraries; different release cadences per module |

For most monorepos, **unified versioning** is recommended because it eliminates the complexity of tracking inter-module version compatibility. The CI-friendly versioning setup in Section 3.5 supports this strategy natively.

### 7.2 Release Procedure

The following procedure creates a release using the unified versioning strategy. It requires no commits to the repository and produces no merge conflicts.

```bash
#!/bin/bash
# release.sh — Monorepo release script
# Usage: ./release.sh <version>
# Example: ./release.sh 1.5.0

set -euo pipefail

VERSION=${1:?Usage: $0 <version>}
RELEASE_BRANCH="release/${VERSION}"

# Verify working tree is clean
if ! git diff --quiet HEAD; then
    echo "ERROR: Working tree has uncommitted changes. Commit or stash before releasing."
    exit 1
fi

# Create release branch
git checkout -b "$RELEASE_BRANCH"

# Build and deploy with the release version
mvn clean deploy \
    -Drevision="$VERSION" \
    -Dchangelist="" \
    -Prelease \
    -T 1C \
    --batch-mode \
    --no-transfer-progress

# Tag the release
git tag -a "v${VERSION}" -m "Release ${VERSION}"
git push origin "$RELEASE_BRANCH" "v${VERSION}"

echo "Release ${VERSION} complete. Tag v${VERSION} pushed."
```

### 7.3 Release Notes Generation

Automated release notes are generated from conventional commits using the `git-changelog-maven-plugin`:

```xml
<plugin>
    <groupId>se.bjurr.gitchangelog</groupId>
    <artifactId>git-changelog-maven-plugin</artifactId>
    <version>2.1.0</version>
    <executions>
        <execution>
            <id>generate-changelog</id>
            <phase>generate-resources</phase>
            <goals>
                <goal>git-changelog</goal>
            </goals>
        </execution>
    </executions>
    <configuration>
        <toRef>HEAD</toRef>
        <fromRef>${previousTag}</fromRef>
        <templateContent>
            # Changelog

            {{#tags}}
            ## {{name}}
            {{#issues}}
            ### {{name}}
            {{#commits}}
            - {{message}} ([{{hash}}]({{commitLink}}))
            {{/commits}}
            {{/issues}}
            {{/tags}}
        </templateContent>
        <file>${project.build.directory}/CHANGELOG.md</file>
        <ignoreCommitsWithoutIssue>false</ignoreCommitsWithoutIssue>
    </configuration>
</plugin>
```

### 7.4 Deployment Pipeline Stages

The deployment pipeline progresses through environments with increasing levels of validation and approval. The following table defines the standard pipeline stages.

| Stage | Environment | Trigger | Approval Required | Rollback Method |
|-------|-------------|---------|-------------------|-----------------|
| Build & Test | CI | Every push | None | N/A |
| Deploy to Dev | Development | Merge to `develop` | None | Automated re-deploy previous version |
| Deploy to Test | Test/QA | Merge to `release/*` | None | Automated re-deploy previous version |
| Manual Exploratory Testing | Test | After automated tests pass | QA sign-off | Re-deploy previous version |
| Deploy to Staging | Staging | After QA sign-off | Tech Lead approval | Automated re-deploy previous version |
| Deploy to Production | Production | After staging validation | Release Manager + Change Advisory Board | Automated rollback via Helm |

#### 7.4.1 GitHub Actions Environment Protection Rules

Configure environment protection rules in the GitHub repository settings for `staging` and `production` environments:

```yaml
# deploy.yml
jobs:
  deploy-staging:
    environment:
      name: staging
      url: https://staging.company.com
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: ./scripts/deploy.sh staging ${{ github.ref_name }}

  deploy-production:
    needs: deploy-staging
    environment:
      name: production
      url: https://app.company.com
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: ./scripts/deploy.sh production ${{ github.ref_name }}
```

### 7.5 Hotfix Procedure

```bash
# 1. Create hotfix branch from the affected release tag
git checkout -b hotfix/1.5.1 v1.5.0

# 2. Apply the fix
# ... make changes ...
git commit -m "fix: resolve critical security vulnerability in auth module"

# 3. Build and test the hotfix
mvn clean verify -Drevision=1.5.1 -Dchangelist= -T 1C

# 4. Deploy the hotfix
mvn deploy -Drevision=1.5.1 -Dchangelist= -Prelease

# 5. Tag the hotfix release
git tag -a "v1.5.1" -m "Hotfix release 1.5.1"
git push origin hotfix/1.5.1 v1.5.1

# 6. Merge hotfix back to main and develop
git checkout main && git merge hotfix/1.5.1
git checkout develop && git merge hotfix/1.5.1
```

---

## 8. Testing & Validation

### 8.1 Module Isolation Testing

Before integrating a module into the reactor build, verify it builds correctly in isolation:

```bash
# Navigate to the module directory
cd suite-a/product-x/product-x-service

# Build with all dependencies installed locally
mvn clean install -am

# Verify tests pass
mvn test

# Verify the artifact is installed in local Maven repository
ls ~/.m2/repository/com/company/suitea/productx/product-x-service/
```

### 8.2 Reactor Build Testing

After isolation testing passes, verify the module builds correctly as part of the full reactor:

```bash
# From the monorepo root
mvn clean install -pl :product-x-service -am --batch-mode

# Verify the module and all its dependents build
mvn clean install -pl :product-x-service -amd --batch-mode
```

### 8.3 Unit Test Configuration

Unit tests use the Maven Surefire plugin and run during the `test` phase. Tests must be fast (< 100ms each) and must not require external services.

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-plugin</artifactId>
    <configuration>
        <includes>
            <include>**/*Test.java</include>
            <include>**/*Tests.java</include>
            <include>**/*Spec.java</include>
        </includes>
        <excludes>
            <exclude>**/*IT.java</exclude>
            <exclude>**/*IntegrationTest.java</exclude>
        </excludes>
        <parallel>classes</parallel>
        <threadCount>4</threadCount>
        <forkCount>1</forkCount>
        <reuseForks>true</reuseForks>
    </configuration>
</plugin>
```

### 8.4 Integration Test Configuration

Integration tests use the Maven Failsafe plugin and run during the `integration-test` and `verify` phases. They are placed in a dedicated `*-it` module to enable selective execution.

```xml
<!-- In product-x-it/pom.xml -->
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-failsafe-plugin</artifactId>
    <configuration>
        <skipITs>${skipITs}</skipITs>
        <includes>
            <include>**/*IT.java</include>
            <include>**/*IntegrationTest.java</include>
        </includes>
        <systemPropertyVariables>
            <spring.profiles.active>test</spring.profiles.active>
        </systemPropertyVariables>
    </configuration>
    <executions>
        <execution>
            <goals>
                <goal>integration-test</goal>
                <goal>verify</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

Use Testcontainers for integration tests that require external services:

```java
@SpringBootTest
@Testcontainers
class ProductXServiceIT {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("product_x_test")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Test
    void shouldCreateAndRetrieveEntity() {
        // test implementation
    }
}
```

### 8.5 Code Coverage Validation

Configure JaCoCo to enforce minimum coverage thresholds. These thresholds should be agreed upon with the team and documented in the module's README.

```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <executions>
        <execution>
            <id>prepare-agent</id>
            <goals>
                <goal>prepare-agent</goal>
            </goals>
        </execution>
        <execution>
            <id>report</id>
            <phase>verify</phase>
            <goals>
                <goal>report</goal>
            </goals>
        </execution>
        <execution>
            <id>check-coverage</id>
            <phase>verify</phase>
            <goals>
                <goal>check</goal>
            </goals>
            <configuration>
                <rules>
                    <rule>
                        <element>BUNDLE</element>
                        <limits>
                            <limit>
                                <counter>LINE</counter>
                                <value>COVEREDRATIO</value>
                                <minimum>0.80</minimum>
                            </limit>
                            <limit>
                                <counter>BRANCH</counter>
                                <value>COVEREDRATIO</value>
                                <minimum>0.70</minimum>
                            </limit>
                        </limits>
                    </rule>
                </rules>
            </configuration>
        </execution>
    </executions>
</plugin>
```

### 8.6 Container Image Validation

After building a container image with Jib, validate it using the following steps:

```bash
# Build image to local Docker daemon (requires Docker)
mvn compile jib:dockerBuild -pl :product-x-app -am

# Verify the image starts correctly
docker run --rm -p 8080:8080 \
    -e SPRING_PROFILES_ACTIVE=dev \
    product-x-app:latest &

# Wait for startup
sleep 10

# Check health endpoint
curl -f http://localhost:8080/actuator/health || exit 1

# Scan the image for vulnerabilities
trivy image --exit-code 1 --severity CRITICAL product-x-app:latest

# Stop the container
docker stop $(docker ps -q --filter ancestor=product-x-app:latest)
```

---

## 9. Documentation Requirements

### 9.1 Module README Template

Every module must have a `README.md` at its root. The following template is mandatory for all module types.

```markdown
# {Module Name}

**Module ID:** `{groupId}:{artifactId}`  
**Type:** {Shared Library | Microservice | Generated Code | Test Utility | Parent POM}  
**Owner:** {Team Name}  
**Status:** {Active | Deprecated | Experimental}

## Overview

{One to three paragraphs describing what this module does, why it exists, and who uses it.}

## Architecture

{Brief description of the module's internal architecture. Include a diagram for complex modules.}

## Dependencies

### Internal Dependencies

| Module | Version | Purpose |
|--------|---------|---------|
| `common-utils` | `${project.version}` | Utility functions |

### External Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| `spring-boot-starter-web` | `3.3.4` | HTTP server |

## Configuration

{Document all configuration properties, environment variables, and their defaults.}

| Property | Default | Description |
|----------|---------|-------------|
| `server.port` | `8080` | HTTP server port |

## Building

```bash
# Build this module and its dependencies
mvn clean install -pl :{artifactId} -am

# Run unit tests only
mvn test -pl :{artifactId}

# Run with integration tests
mvn verify -pl :{artifactId} -am -DskipITs=false
```

## Deployment

{For deployable modules: describe how to deploy, what environments exist, and how to configure each.}

## API Documentation

{For modules with APIs: link to OpenAPI spec or generated documentation.}

## Runbook

{Link to the operations runbook in `docs/runbooks/`.}

## Contributing

{Link to the monorepo-level CONTRIBUTING.md and any module-specific guidelines.}
```

### 9.2 Architecture Diagrams

Architecture diagrams must be created using a text-based diagramming tool (PlantUML, Mermaid, or C4-PlantUML) so they can be version-controlled alongside the code. Store diagrams in `docs/architecture/` at the appropriate hierarchy level.

**C4 Context Diagram (PlantUML):**

```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml

Person(user, "End User", "Uses the Product X web interface")
System(productX, "Product X", "Manages business domain X")
System_Ext(authSystem, "Identity Provider", "Provides OAuth2/OIDC authentication")
System_Ext(notificationSystem, "Notification Service", "Sends emails and push notifications")

Rel(user, productX, "Uses", "HTTPS")
Rel(productX, authSystem, "Authenticates via", "HTTPS/OIDC")
Rel(productX, notificationSystem, "Sends notifications via", "HTTPS/REST")
@enduml
```

### 9.3 Operations Runbook Template

Each deployable module must have an operations runbook at `docs/runbooks/{module-name}-runbook.md`.

```markdown
# {Module Name} Operations Runbook

**Last Updated:** {Date}  
**On-Call Contact:** {Team/Slack channel}  
**Escalation Path:** {Level 1 → Level 2 → Level 3}

## Service Overview

{Brief description of the service and its business criticality.}

## Health Checks

| Endpoint | Expected Response | Action if Failing |
|----------|-------------------|-------------------|
| `GET /actuator/health` | `{"status":"UP"}` | Restart pod; escalate if persists |
| `GET /actuator/health/db` | `{"status":"UP"}` | Check database connectivity |

## Common Incidents

### Incident: High Memory Usage

**Symptoms:** Pod memory usage > 85%; OOMKilled events in Kubernetes.  
**Diagnosis:** `kubectl top pod -l app={module-name}`  
**Resolution:** Increase `resources.limits.memory` in Helm values; investigate memory leak.

### Incident: Slow Response Times

**Symptoms:** P99 latency > 2 seconds; alerts from monitoring platform.  
**Diagnosis:** Check database slow query log; review distributed traces.  
**Resolution:** Identify slow queries; add database indexes; scale horizontally if needed.

## Deployment Procedures

### Standard Deployment

```bash
helm upgrade {module-name} ./charts/{module-name} \
    --namespace {namespace} \
    --set image.tag={version} \
    --wait --timeout 5m
```

### Rollback

```bash
helm rollback {module-name} --namespace {namespace}
```

## Monitoring and Alerting

{Link to Grafana dashboards, alert definitions, and SLO documentation.}
```

### 9.4 Product and Suite Documentation

Product-level documentation must be maintained in `suite-a/product-x/docs/` and must include:

- A product overview document describing the product's purpose, target users, and key features.
- An architecture document showing the product's module decomposition and data flows.
- A deployment guide covering environment-specific configuration and deployment procedures.
- A data dictionary documenting the product's domain model and data schemas.

Suite-level documentation in `suite-a/docs/` must include:

- A suite overview describing how the products within the suite relate to each other.
- A cross-product integration guide describing shared services, APIs, and data flows between products.
- A suite-level architecture diagram showing all products and their relationships.

---

## 10. Compliance & Traceability Setup

### 10.1 Build Provenance Metadata

Every build artifact must carry metadata that enables traceability from the deployed artifact back to the exact source code commit, build environment, and approval chain. The `git-commit-id-maven-plugin` embeds this metadata into the artifact at build time.

The `git.properties` file embedded in the JAR contains:

```properties
git.branch=main
git.build.time=2025-10-15T14:32:01+0000
git.build.version=1.5.0
git.commit.id=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
git.commit.time=2025-10-15T14:28:44+0000
```

This information is exposed via the Spring Boot Actuator `/actuator/info` endpoint in deployable services, enabling operations teams to identify the exact version of running software at any time.

### 10.2 SBOM Archival and Retention

SBOMs generated by the CycloneDX plugin must be archived according to the following retention policy:

| Artifact Type | Retention Period | Storage Location | Access Control |
|---------------|-----------------|------------------|----------------|
| SBOM (JSON) | 7 years | Artifact registry (Artifactory/Nexus) | Read: All; Write: CI only |
| SBOM (XML) | 7 years | Artifact registry | Read: All; Write: CI only |
| Security scan results | 7 years | Dedicated compliance bucket | Read: Security team; Write: CI only |
| Test reports | 3 years | CI artifact storage | Read: Dev team; Write: CI only |
| Build logs | 1 year | CI system | Read: Dev team; Write: CI only |
| Container image manifests | 7 years | Container registry | Read: Ops team; Write: CI only |

### 10.3 Security Scan Result Archival

All security scan results must be archived as CI artifacts and linked to the corresponding release. Configure the CI pipeline to upload scan results:

```yaml
- name: Upload OWASP dependency check report
  uses: actions/upload-artifact@v4
  with:
    name: dependency-check-report-${{ github.run_number }}
    path: '**/target/dependency-check-reports/**'
    retention-days: 2555  # 7 years

- name: Upload SpotBugs report
  uses: actions/upload-artifact@v4
  with:
    name: spotbugs-report-${{ github.run_number }}
    path: '**/target/spotbugsXml.xml'
    retention-days: 2555
```

### 10.4 Deployment Attestation

For regulated environments, each production deployment must be accompanied by a signed attestation document confirming:

- All automated tests passed (with links to test reports).
- All security scans passed or findings were formally accepted (with links to scan reports).
- The SBOM has been generated and archived.
- The deployment was approved by authorised personnel.
- The deployed version matches the tested version (via commit SHA verification).

The attestation document template is stored at `docs/templates/deployment-attestation.md` and must be completed and signed (digitally or physically, per regulatory requirement) before each production deployment.

### 10.5 Audit Logging Configuration

For modules that process regulated data, configure audit logging to capture all data access and modification events:

```yaml
# application.yml
logging:
  level:
    com.company.audit: INFO
  pattern:
    console: "%d{ISO8601} [%thread] %-5level %logger{36} - %msg%n"

management:
  auditevents:
    enabled: true
  endpoints:
    web:
      exposure:
        include: auditevents,health,info,metrics
```

Audit logs must be shipped to a centralised, tamper-evident log management system (e.g., Splunk, Elasticsearch with WORM storage) and retained for the period required by the applicable regulatory framework.

### 10.6 Regulatory Framework Mapping

The following table maps regulatory requirements to specific implementation controls in this SOP.

| Requirement | Regulatory Framework | Implementation Control | SOP Section |
|-------------|---------------------|----------------------|-------------|
| Software composition transparency | SOC 2, PCI-DSS | CycloneDX SBOM generation | 6.3 |
| Vulnerability management | SOC 2, PCI-DSS, HIPAA | OWASP Dependency-Check, Trivy | 6.2 |
| Change management | SOC 2, ISO 27001 | GitHub PR reviews, approval gates | 7.4 |
| Audit trail | SOC 2, PCI-DSS, HIPAA | Audit logging, build provenance | 10.1, 10.5 |
| Separation of duties | SOC 2, PCI-DSS | Environment protection rules | 7.4.1 |
| Artifact integrity | SLSA Level 2 | Build provenance attestation | 6.4 |
| Data retention | GDPR, HIPAA | Retention policies | 10.2 |

---

## 11. Migration Checklist

This checklist must be completed in order for every module being migrated. Each item must be signed off by the responsible engineer before proceeding to the next phase.

### Phase 0: Pre-Migration Preparation

- [ ] **P0.1** Complete the Module Assessment Questionnaire (Section 1.1) and record answers.
- [ ] **P0.2** Classify the module type using the decision tree (Section 1.2) and record the classification.
- [ ] **P0.3** Determine the target location in the monorepo hierarchy (Section 1.4).
- [ ] **P0.4** Complete the Key Refactoring Requirements Summary table (Section 1.5).
- [ ] **P0.5** Identify all internal dependencies and verify their migration status.
- [ ] **P0.6** If any internal dependencies are not yet in the monorepo, create migration tickets for them and establish a migration order.
- [ ] **P0.7** Notify consuming teams of the planned migration date and any expected breaking changes.
- [ ] **P0.8** Create a feature branch in the monorepo: `git checkout -b migrate/{module-name}`.
- [ ] **P0.9** Back up the existing standalone repository (ensure it is not deleted until post-migration validation is complete).

### Phase 1: Directory Structure and POM Setup

- [ ] **P1.1** Create the target directory structure following Section 2.
- [ ] **P1.2** Copy source code, resources, and schema files from the standalone repository.
- [ ] **P1.3** Verify that `target/` and generated sources are excluded from the copy (check `.gitignore`).
- [ ] **P1.4** Create or update the parent POM at the appropriate hierarchy level.
- [ ] **P1.5** Create the module's `pom.xml` using the appropriate template from Section 3.3.
- [ ] **P1.6** Set the `<parent>` reference with the correct `<relativePath>`.
- [ ] **P1.7** Remove the `<version>` element from the module's `pom.xml` (version is inherited from parent).
- [ ] **P1.8** Add the module to the parent POM's `<modules>` list.
- [ ] **P1.9** Add the module to the root `<dependencyManagement>` section if it is consumed by other modules.
- [ ] **P1.10** Configure code generation plugins if applicable (Section 3.6).
- [ ] **P1.11** Configure Jib if the module is a deployable artifact (Section 3.3.2).

### Phase 2: Dependency Resolution

- [ ] **P2.1** Run `mvn dependency:list -DincludeGroupIds=com.company` and record all internal dependencies.
- [ ] **P2.2** For each internal dependency already in the monorepo: remove `<version>` and ensure it is in `<dependencyManagement>`.
- [ ] **P2.3** For each internal dependency not yet in the monorepo: retain the Artifactory reference and create a follow-up ticket.
- [ ] **P2.4** Run `mvn dependency:tree` and verify no circular dependencies exist.
- [ ] **P2.5** Run `mvn enforcer:enforce` and resolve all `dependencyConvergence` failures.
- [ ] **P2.6** Run `mvn dependency:analyze` and address all "used but undeclared" warnings.
- [ ] **P2.7** Remove Artifactory `<repositories>` entries for internal artifacts from the module's `pom.xml`.

### Phase 3: Build Configuration

- [ ] **P3.1** Run `mvn clean compile -pl :{module-name} -am` and verify it succeeds.
- [ ] **P3.2** Run `mvn test -pl :{module-name}` and verify all unit tests pass.
- [ ] **P3.3** If integration tests exist: run `mvn verify -pl :{module-name} -am -DskipITs=false` and verify all tests pass.
- [ ] **P3.4** If the module produces a container image: run `mvn compile jib:dockerBuild -pl :{module-name} -am` and verify the image builds.
- [ ] **P3.5** Run `mvn clean install -pl :{module-name} -amd` and verify all dependent modules still build.
- [ ] **P3.6** Run a full reactor build from the root: `mvn clean install -T 1C` and verify no failures.

### Phase 4: CI/CD Integration

- [ ] **P4.1** Create or update the GitHub Actions workflow to include the new module.
- [ ] **P4.2** Verify the change detection script correctly identifies the new module.
- [ ] **P4.3** Configure security scanning for the module (OWASP, SpotBugs).
- [ ] **P4.4** Configure SBOM generation for deployable modules.
- [ ] **P4.5** Run the CI pipeline on the migration branch and verify all stages pass.
- [ ] **P4.6** Verify test results and coverage reports are uploaded as CI artifacts.

### Phase 5: Documentation

- [ ] **P5.1** Create `README.md` using the template in Section 9.1.
- [ ] **P5.2** Create or update architecture diagrams if the module introduces new system components.
- [ ] **P5.3** Create an operations runbook for deployable modules (Section 9.3 template).
- [ ] **P5.4** Update product-level and suite-level documentation to reflect the new module.
- [ ] **P5.5** Document all configuration properties and environment variables.

### Phase 6: Compliance Setup

- [ ] **P6.1** Verify `git-commit-id-maven-plugin` is configured and `git.properties` is embedded in the artifact.
- [ ] **P6.2** Verify SBOM is generated and archived as a CI artifact.
- [ ] **P6.3** Verify security scan results are archived as CI artifacts.
- [ ] **P6.4** Configure audit logging if the module processes regulated data.
- [ ] **P6.5** Complete and obtain sign-off on the deployment attestation document for the first production deployment.

### Phase 7: Post-Migration Validation and Sign-Off

- [ ] **P7.1** Deploy the module to the development environment and verify it functions correctly.
- [ ] **P7.2** Deploy the module to the test environment and execute the full test suite.
- [ ] **P7.3** Obtain QA sign-off on test results.
- [ ] **P7.4** Deploy the module to staging and conduct smoke testing.
- [ ] **P7.5** Verify monitoring and alerting are configured and functional.
- [ ] **P7.6** Obtain Tech Lead sign-off on the migration.
- [ ] **P7.7** Merge the migration branch to `develop` via pull request.
- [ ] **P7.8** Archive the standalone repository (do not delete; mark as archived in GitHub).
- [ ] **P7.9** Update the monorepo migration tracking spreadsheet.
- [ ] **P7.10** Send migration completion notification to consuming teams.

### Rollback Procedures

If any phase fails and cannot be resolved within the agreed migration window, execute the following rollback procedure:

**Rollback from Phase 1–3 (pre-CI):**

```bash
# Simply abandon the migration branch
git checkout main
git branch -D migrate/{module-name}
# The standalone repository remains unchanged; no action needed
```

**Rollback from Phase 4–5 (post-CI, pre-production):**

```bash
# Revert the merge commit if the branch was already merged
git revert -m 1 <merge-commit-sha>
git push origin main
# Notify consuming teams that the migration has been reverted
```

**Rollback from Phase 7 (post-production deployment):**

```bash
# Roll back the Helm release
helm rollback {module-name} --namespace {namespace}

# If Helm rollback fails, redeploy the previous version explicitly
helm upgrade {module-name} ./charts/{module-name} \
    --namespace {namespace} \
    --set image.tag={previous-version} \
    --wait --timeout 5m
```

---

## 12. Troubleshooting Guide

### 12.1 Build Failures

#### 12.1.1 `Could not resolve dependencies` / `Artifact not found in repository`

**Symptom:** Build fails with `Could not resolve artifact com.company:module-name:jar:${revision}${changelist}`.

**Cause:** The dependency's module has not been built and installed in the local Maven repository, or the version property is not being resolved correctly.

**Resolution:**

```bash
# Step 1: Verify the dependency module is in the reactor
mvn help:evaluate -Dexpression=project.modules -pl :parent-module-name

# Step 2: Build the dependency module first
mvn clean install -pl :module-name -am

# Step 3: Verify the flatten plugin has resolved the version
cat target/.flattened-pom.xml | grep "<version>"

# Step 4: If the version shows unresolved ${revision}, verify .mvn/maven.config exists
cat .mvn/maven.config
```

#### 12.1.2 `The projects in the reactor contain a cyclic reference`

**Symptom:** Build fails immediately with a cyclic reference error.

**Cause:** Two or more modules have circular dependencies.

**Resolution:** Follow the circular dependency resolution procedure in Section 4.3. As a temporary workaround to identify the cycle:

```bash
mvn validate 2>&1 | grep -A5 "cyclic"
```

#### 12.1.3 `Failed to execute goal: generate-sources` (Protobuf)

**Symptom:** Protobuf compilation fails with `protoc: command not found` or `os.detected.classifier not set`.

**Cause:** The `os-maven-plugin` extension is not configured, or the `protoc` binary cannot be resolved.

**Resolution:**

```bash
# Verify the extension is in pom.xml <build><extensions>
grep -A5 "os-maven-plugin" pom.xml

# Force re-download of protoc binary
mvn clean generate-sources -U -pl :generated-module-name

# If on Apple Silicon (arm64), ensure protoc has an arm64 build available
# or use Rosetta: arch -x86_64 mvn generate-sources
```

#### 12.1.4 `Failed to execute goal: generate-sources` (OpenAPI)

**Symptom:** OpenAPI generation fails with `Input spec is invalid`.

**Cause:** The OpenAPI specification file contains validation errors.

**Resolution:**

```bash
# Validate the spec using the OpenAPI CLI
npx @openapitools/openapi-generator-cli validate \
    -i src/main/resources/api/product-x-api.yaml

# Run generation in dry-run mode to see what would be generated
mvn generate-sources -Dcodegen.dryRun=true -pl :generated-module-name
```

### 12.2 Dependency Resolution Problems

#### 12.2.1 `Dependency convergence error`

**Symptom:** Build fails with `Dependency convergence error for artifact:version`.

**Cause:** The `maven-enforcer-plugin`'s `dependencyConvergence` rule has detected multiple versions of the same dependency in the dependency tree.

**Resolution:**

```bash
# Identify all paths to the conflicting dependency
mvn dependency:tree -Dverbose -Dincludes=groupId:artifactId

# Add the desired version to root <dependencyManagement>
# Then re-run to verify convergence
mvn enforcer:enforce -Drules=dependencyConvergence
```

#### 12.2.2 `NoSuchMethodError` or `ClassNotFoundException` at runtime

**Symptom:** Application starts but fails at runtime with class or method not found errors.

**Cause:** A dependency version conflict was resolved at compile time using one version but a different version is on the runtime classpath.

**Resolution:**

```bash
# Check the effective classpath
mvn dependency:build-classpath -pl :module-name

# Compare compile-time and runtime dependencies
mvn dependency:list -DincludeScope=compile
mvn dependency:list -DincludeScope=runtime

# Add explicit dependency management for the conflicting artifact
```

### 12.3 Version Conflicts

#### 12.3.1 `${revision}` appears in published POM

**Symptom:** Consumers of a published artifact see `<version>${revision}${changelist}</version>` in the POM instead of a resolved version number.

**Cause:** The `flatten-maven-plugin` was not executed before the `deploy` phase, or it was not configured correctly.

**Resolution:**

```bash
# Verify flatten plugin is in the build
mvn help:effective-pom -pl :module-name | grep -A5 "flatten"

# Manually run flatten and inspect the output
mvn flatten:flatten -pl :module-name
cat target/.flattened-pom.xml | grep "<version>"

# Ensure flatten runs in process-resources phase (before package)
```

### 12.4 CI/CD Pipeline Failures

#### 12.4.1 Change detection produces empty module list

**Symptom:** The CI pipeline detects no changed modules even though files were modified.

**Cause:** The `git diff` base reference is incorrect, or the change detection script has a path resolution bug.

**Resolution:**

```bash
# Debug the change detection script locally
git diff --name-only HEAD~1 HEAD

# Verify the script handles the case where a file is in the root directory
# (no parent pom.xml to find)

# For the first commit in a repository, use git diff --diff-filter=A HEAD
```

#### 12.4.2 Jib fails with `UNAUTHORIZED` when pushing to registry

**Symptom:** Container image build fails with authentication error.

**Cause:** The `CONTAINER_REGISTRY` environment variable is not set, or the registry credentials are not configured in the CI environment.

**Resolution:**

```bash
# Verify environment variables are set in CI
echo $CONTAINER_REGISTRY
echo $REGISTRY_USERNAME

# For GitHub Actions, ensure secrets are configured:
# Settings → Secrets and variables → Actions
# Add: CONTAINER_REGISTRY, REGISTRY_USERNAME, REGISTRY_PASSWORD

# Test authentication locally
docker login $CONTAINER_REGISTRY -u $REGISTRY_USERNAME -p $REGISTRY_PASSWORD
```

#### 12.4.3 OWASP Dependency-Check fails with NVD database timeout

**Symptom:** Security scan fails with `Could not update NVD database` or timeout errors.

**Cause:** The NVD API rate limit has been exceeded, or the NVD API key is not configured.

**Resolution:**

```bash
# Configure NVD API key (register at https://nvd.nist.gov/developers/request-an-api-key)
# Add to CI secrets: NVD_API_KEY

# Use a cached NVD database in CI
# Configure the plugin to use a local data directory
<configuration>
    <dataDirectory>${project.build.directory}/dependency-check-data</dataDirectory>
</configuration>

# Cache the data directory between CI runs using actions/cache
```

### 12.5 Performance Issues

#### 12.5.1 Full reactor build takes too long

**Symptom:** `mvn clean install` from the root takes more than 30 minutes.

**Diagnosis:**

```bash
# Profile the build to identify slow modules
mvn clean install -T 1C 2>&1 | grep "BUILD SUCCESS\|BUILD FAILURE\|seconds"

# Use Maven's built-in profiling
mvn clean install -T 1C -Dmaven.ext.class.path=/path/to/maven-profiler.jar
```

**Resolution options:**

1. Enable the Maven Build Cache Extension (Section 5.1) to skip unchanged modules.
2. Use incremental builds with `-pl` and `-amd` flags (Section 5.5).
3. Increase parallel thread count: `-T 1C` or `-T 0.75C`.
4. Increase JVM heap: `MAVEN_OPTS="-Xmx8g"`.
5. Move integration tests to a separate CI stage that runs less frequently.

#### 12.5.2 Out of memory during parallel build

**Symptom:** Build fails with `java.lang.OutOfMemoryError: Java heap space` during parallel execution.

**Resolution:**

```bash
# Reduce parallel thread count
mvn clean install -T 2  # Instead of -T 1C

# Increase Maven JVM heap
export MAVEN_OPTS="-Xmx8g -XX:+UseG1GC"

# Reduce Surefire fork heap
<configuration>
    <argLine>-Xmx256m</argLine>  <!-- Reduce from 512m -->
</configuration>
```

### 12.6 Container Image Build Failures

#### 12.6.1 Jib fails with `Base image not found`

**Symptom:** Jib build fails with `Could not pull base image`.

**Cause:** The base image (`eclipse-temurin:17-jre-alpine`) is not accessible from the build environment, or the image tag does not exist.

**Resolution:**

```bash
# Verify the base image exists
docker pull eclipse-temurin:17-jre-alpine

# If building in an air-gapped environment, use a locally mirrored base image
<from>
    <image>${internal.registry}/eclipse-temurin:17-jre-alpine</image>
</from>

# Build to local Docker daemon instead of registry for testing
mvn compile jib:dockerBuild -pl :module-name -am
```

### 12.7 Code Generation Issues

#### 12.7.1 Generated sources not compiled

**Symptom:** Compilation fails because classes from `target/generated-sources/` are not found.

**Cause:** The code generation plugin is not adding the generated sources directory to the compile source root.

**Resolution:**

```bash
# Verify the generated sources directory exists
ls target/generated-sources/

# For OpenAPI generator, verify addCompileSourceRoot is true (default)
# For protobuf, verify the plugin is bound to generate-sources phase
mvn help:effective-pom -pl :module-name | grep -A20 "protobuf-maven-plugin"

# Force regeneration
mvn clean generate-sources -pl :module-name
```

#### 12.7.2 Protobuf version mismatch

**Symptom:** Compilation fails with `protoc` version incompatibility errors.

**Cause:** The `protobuf-java` runtime version does not match the `protoc` compiler version.

**Resolution:** Ensure both versions are aligned in the root POM:

```xml
<properties>
    <protobuf.version>3.25.5</protobuf.version>  <!-- Must match protoc version -->
</properties>
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.google.protobuf</groupId>
            <artifactId>protobuf-java</artifactId>
            <version>${protobuf.version}</version>  <!-- Same version as protoc -->
        </dependency>
    </dependencies>
</dependencyManagement>
```

---

## 13. Example Commands

This section provides a comprehensive reference of Maven commands for common operations in the monorepo. All commands are executed from the monorepo root unless otherwise noted.

### 13.1 Building Specific Modules

```bash
# Build a single module (with all its upstream dependencies)
mvn clean install -pl :product-x-service -am

# Build a single module and all modules that depend on it
mvn clean install -pl :common-utils -amd

# Build multiple specific modules
mvn clean install -pl :product-x-service,:product-x-data -am

# Build an entire product (all modules under product-x/)
mvn clean install -pl suite-a/product-x -am

# Build an entire suite
mvn clean install -pl suite-a -am

# Resume a failed build from a specific module
mvn clean install -rf :product-x-app

# Build without running tests
mvn clean install -pl :product-x-service -am -DskipTests

# Build skipping only unit tests (integration tests still run)
mvn clean install -pl :product-x-service -am -Dmaven.test.skip=false -DskipTests=true
```

### 13.2 Running Tests

```bash
# Run unit tests for a specific module
mvn test -pl :product-x-service

# Run unit tests for a specific test class
mvn test -pl :product-x-service -Dtest=ProductXServiceTest

# Run unit tests for a specific test method
mvn test -pl :product-x-service -Dtest=ProductXServiceTest#shouldCreateEntity

# Run integration tests for a specific module
mvn verify -pl :product-x-it -am -DskipITs=false

# Run integration tests with a specific Spring profile
mvn verify -pl :product-x-it -am -DskipITs=false \
    -Dspring.profiles.active=test

# Run performance tests
mvn verify -pl :product-x-it -am -DskipITs=false -Pperf-tests

# Run all tests in the entire monorepo
mvn clean verify -T 1C -DskipITs=false

# Generate coverage report for a module
mvn jacoco:report -pl :product-x-service
```

### 13.3 Dependency Analysis

```bash
# Display dependency tree for a module
mvn dependency:tree -pl :product-x-service

# Display verbose dependency tree (shows omitted duplicates)
mvn dependency:tree -Dverbose -pl :product-x-service

# Filter dependency tree to a specific artifact
mvn dependency:tree -Dverbose -Dincludes=org.slf4j:slf4j-api -pl :product-x-service

# List all resolved dependencies
mvn dependency:list -pl :product-x-service

# List only internal dependencies
mvn dependency:list -DincludeGroupIds=com.company -pl :product-x-service

# Analyse unused/undeclared dependencies
mvn dependency:analyze -pl :product-x-service

# Check for dependency convergence issues
mvn enforcer:enforce -Drules=dependencyConvergence -pl :product-x-service

# Check for outdated dependencies
mvn versions:display-dependency-updates -pl :product-x-service
```

### 13.4 Building Container Images

```bash
# Build container image and push to registry (requires CONTAINER_REGISTRY env var)
mvn compile jib:build -pl :product-x-app -am \
    -Drevision=1.5.0 -Dchangelist=

# Build container image to local Docker daemon (for local testing)
mvn compile jib:dockerBuild -pl :product-x-app -am

# Build container image to a local tarball (for air-gapped environments)
mvn compile jib:buildTar -pl :product-x-app -am \
    -Djib.outputPaths.tar=target/product-x-app.tar

# Build image with a specific tag
mvn compile jib:build -pl :product-x-app -am \
    -Djib.to.tags=1.5.0,latest,stable

# Scan the built image for vulnerabilities
trivy image --exit-code 1 --severity CRITICAL \
    ${CONTAINER_REGISTRY}/product-x-app:1.5.0
```

### 13.5 Release Commands

```bash
# Build a release (no SNAPSHOT suffix)
mvn clean deploy \
    -Drevision=1.5.0 \
    -Dchangelist="" \
    -Prelease \
    -T 1C \
    --batch-mode

# Build a release for a specific module only
mvn clean deploy \
    -pl :product-x-app -am \
    -Drevision=1.5.0 \
    -Dchangelist="" \
    -Prelease

# Tag a release
git tag -a "v1.5.0" -m "Release 1.5.0"
git push origin v1.5.0

# Build a snapshot
mvn clean install \
    -Drevision=1.5.0 \
    -Dchangelist=-SNAPSHOT \
    -T 1C

# Update all dependency versions to a new release
mvn versions:set -DnewVersion=1.6.0-SNAPSHOT
mvn versions:commit
```

### 13.6 Parallel Build Commands

```bash
# Build with 4 threads
mvn clean install -T 4

# Build with 1 thread per CPU core
mvn clean install -T 1C

# Build with 75% of available CPU cores
mvn clean install -T 0.75C

# Build with thread count and memory settings
MAVEN_OPTS="-Xmx8g -XX:+UseG1GC" mvn clean install -T 1C

# Build with thread count, skip tests, and batch mode (fastest CI build)
mvn clean install -T 1C -DskipTests --batch-mode --no-transfer-progress

# Incremental build: only changed modules and their dependents
CHANGED=$(./scripts/detect-changed-modules.sh HEAD~1 HEAD)
mvn clean install -pl "$CHANGED" -amd -T 1C
```

### 13.7 SBOM and Security Commands

```bash
# Generate SBOM for a deployable module
mvn cyclonedx:makeAggregateBom -pl :product-x-app -am

# Run OWASP dependency check
mvn dependency-check:check -pl :product-x-service

# Run SpotBugs static analysis
mvn spotbugs:check -pl :product-x-service

# Run all security checks
mvn verify -Pci -pl :product-x-app -am -DskipITs=true

# Generate effective POM (useful for debugging)
mvn help:effective-pom -pl :product-x-service

# Display active profiles
mvn help:active-profiles -pl :product-x-service
```

### 13.8 Deployment Commands

```bash
# Deploy to development environment (Helm)
helm upgrade --install product-x-app ./charts/product-x-app \
    --namespace product-x-dev \
    --set image.tag=1.5.0-SNAPSHOT \
    --set environment=dev \
    --wait --timeout 5m

# Deploy to production environment
helm upgrade --install product-x-app ./charts/product-x-app \
    --namespace product-x-prod \
    --set image.tag=1.5.0 \
    --set environment=prod \
    --set replicaCount=3 \
    --wait --timeout 10m

# Roll back a deployment
helm rollback product-x-app --namespace product-x-prod

# Check deployment status
kubectl rollout status deployment/product-x-app \
    --namespace product-x-prod

# View application logs
kubectl logs -l app=product-x-app \
    --namespace product-x-prod \
    --tail=100 \
    --follow
```

---

## References

[^1]: Apache Maven Project. "Introduction to the Standard Directory Layout." [https://maven.apache.org/guides/introduction/introduction-to-the-standard-directory-layout.html](https://maven.apache.org/guides/introduction/introduction-to-the-standard-directory-layout.html)

[^2]: Apache Maven Project. "Maven CI Friendly Versions." [https://maven.apache.org/guides/mini/guide-maven-ci-friendly.html](https://maven.apache.org/guides/mini/guide-maven-ci-friendly.html)

[^3]: MojoHaus. "Flatten Maven Plugin." [https://www.mojohaus.org/flatten-maven-plugin/](https://www.mojohaus.org/flatten-maven-plugin/)

[^4]: Apache Maven Project. "Dependency Convergence – Apache Maven Enforcer Built-In Rules." [https://maven.apache.org/enforcer/enforcer-rules/dependencyConvergence.html](https://maven.apache.org/enforcer/enforcer-rules/dependencyConvergence.html)

[^5]: Apache Maven Project. "Maven Build Cache Extension." [https://maven.apache.org/extensions/maven-build-cache-extension/usage.html](https://maven.apache.org/extensions/maven-build-cache-extension/usage.html)

[^6]: CycloneDX. "CycloneDX Maven Plugin." [https://github.com/CycloneDX/cyclonedx-maven-plugin](https://github.com/CycloneDX/cyclonedx-maven-plugin)

[^7]: Google Cloud Tools. "Jib Maven Plugin." [https://github.com/GoogleContainerTools/jib/blob/master/jib-maven-plugin/README.md](https://github.com/GoogleContainerTools/jib/blob/master/jib-maven-plugin/README.md)

[^8]: OpenAPI Tools. "OpenAPI Generator Maven Plugin." [https://github.com/OpenAPITools/openapi-generator/blob/master/modules/openapi-generator-maven-plugin/README.md](https://github.com/OpenAPITools/openapi-generator/blob/master/modules/openapi-generator-maven-plugin/README.md)

[^9]: Xolstice. "Maven Protocol Buffers Plugin – Usage." [https://www.xolstice.org/protobuf-maven-plugin/usage.html](https://www.xolstice.org/protobuf-maven-plugin/usage.html)

[^10]: OWASP. "Dependency-Check Maven Plugin." [https://owasp.org/www-project-dependency-check/](https://owasp.org/www-project-dependency-check/)

[^11]: SpotBugs. "SpotBugs Maven Plugin." [https://spotbugs.github.io/](https://spotbugs.github.io/)

[^12]: GitHub. "Managing environments for deployment." [https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment](https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment)

[^13]: git-commit-id. "Maven git commit id plugin." [https://github.com/git-commit-id/git-commit-id-maven-plugin](https://github.com/git-commit-id/git-commit-id-maven-plugin)
