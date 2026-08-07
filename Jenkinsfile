pipeline {
  agent { label 'windows' }

  tools {
    nodejs 'node-lts'
  }

  parameters {
    choice(name: 'REGION', choices: ['all', 'andalucia', 'madrid'], description: 'Región a ejecutar')
  }

  environment {
    HEADLESS         = 'true'
    BASE_URL         = credentials('industria-base-url')
    TEST_USERNAME    = credentials('industria-test-username')
    MADRID_USERNAME  = credentials('industria-madrid-username')
    TESTRAIL_URL     = credentials('industria-testrail-url')
    TESTRAIL_USER    = credentials('industria-testrail-user')
    TESTRAIL_API_KEY = credentials('industria-testrail-api-key')
    TESTRAIL_ENABLED = 'true'
  }

  stages {
    stage('Install') {
      steps {
        bat 'node -v && npm -v'
        bat 'npm cache clean --force'
        bat 'npm ci'
        bat 'npx playwright install --with-deps chromium'
      }
    }

    stage('Andalucía') {
      when {
        anyOf {
          expression { params.REGION == 'all' }
          expression { params.REGION == 'andalucia' }
        }
      }
      environment {
        PLAYWRIGHT_HTML_REPORT       = 'reports/html-andalucia'
        PLAYWRIGHT_JUNIT_OUTPUT_FILE = 'reports/junit/andalucia-results.xml'
      }
      steps {
        bat 'npm run test:andalucia'
      }
    }

    stage('Madrid') {
      when {
        anyOf {
          expression { params.REGION == 'all' }
          expression { params.REGION == 'madrid' }
        }
      }
      environment {
        PLAYWRIGHT_HTML_REPORT       = 'reports/html-madrid'
        PLAYWRIGHT_JUNIT_OUTPUT_FILE = 'reports/junit/madrid-results.xml'
      }
      steps {
        bat 'npm run test:madrid'
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
    }
  }
}
