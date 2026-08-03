pipeline {
  agent { label 'SVJenkinsWin' }

  parameters {
    choice(name: 'REGION', choices: ['all', 'andalucia', 'madrid'], description: 'Región a ejecutar')
  }

  environment {
    HEADLESS         = 'true'
    BASE_URL         = credentials('industria-base-url')
    TEST_USERNAME    = credentials('industria-test-username')
    TEST_PASSWORD    = credentials('industria-test-password')
    MADRID_USERNAME  = credentials('industria-madrid-username')
    MADRID_PASSWORD  = credentials('industria-madrid-password')
    TESTRAIL_URL     = credentials('industria-testrail-url')
    TESTRAIL_USER    = credentials('industria-testrail-user')
    TESTRAIL_API_KEY = credentials('industria-testrail-api-key')
    TESTRAIL_ENABLED = 'true'
  }

  stages {
    stage('Install') {
      steps {
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
