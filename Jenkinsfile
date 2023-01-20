pipeline {
    agent { label 'ec2-build-node' }
    environment {
        HOST_PATH = credentials('host-path')
        HOST = credentials('host')
        AWS_DEFAULT_REGION = credentials('AWS_DEFAULT_REGION')
        BUCKET_NAME = credentials('BUCKET_NAME')
    }
    stages {
        stage('Clone repository') {
            steps {
                checkout scm
            }
        }

        stage('Test, Build, and Push API') {
            when {
                anyOf {
                    changeset 'api/**/*'
                    expression { params.FORCE_API == true }
                }
            }
            steps {
                dir('api') {
                    script {
                        docker.build('sfo-api:dev')
                        sh "docker run --entrypoint='' sfo-api:dev black --check app"
                        sh "docker run --entrypoint='' sfo-api:dev pytest"
                        withCredentials([
                            usernamePassword(credentialsId: 'gh-pat', usernameVariable: 'OWNER', passwordVariable: 'PAT')
                        ]) {
                            sh 'echo $PAT | docker login ghcr.io -u $OWNER --password-stdin'
                            sh "docker tag sfo-api:dev ghcr.io/${OWNER}/sfo-api:latest"
                            sh "docker push ghcr.io/${OWNER}/sfo-api:latest"
                        }
                    }
                }
            }
        }

        stage('Test, Build, and Push Worker') {
            when {
                anyOf {
                    changeset 'worker/**/*'
                    expression { params.FORCE_WORKER == true }
                }
            }
            steps {
                dir('worker') {
                    script {
                        docker.build 'sfo-worker:dev', '--build-arg USER_UID=1001 .'
                        sh "docker run --rm --entrypoint='' sfo-worker:dev black --check app"
                        sh "docker run --entrypoint='' sfo-worker:dev pytest"
                        withCredentials([
                            usernamePassword(credentialsId: 'gh-pat', usernameVariable: 'OWNER', passwordVariable: 'PAT')
                        ]) {
                            sh 'echo $PAT | docker login ghcr.io -u $OWNER --password-stdin'
                            sh "docker tag sfo-worker:dev ghcr.io/${OWNER}/sfo-worker:latest"
                            sh "docker push ghcr.io/${OWNER}/sfo-worker:latest"
                        }
                    }
                }
            }
        }

        stage('Test, Build, and Push Shennong Runner') {
            when {
                anyOf {
                    changeset 'shennong_runner/**/*'
                    expression { params.FORCE_RUNNER == true }
                }
            }
            steps {
                dir('shennong_runner') {
                    script {
                        docker.build('ghcr.io/perceptimatic/sfo-shennong-runner:dev')
                        sh "docker run --rm --entrypoint='' ghcr.io/perceptimatic/sfo-shennong-runner:dev black --check app"
                        sh "docker run --entrypoint='' ghcr.io/perceptimatic/sfo-shennong-runner:dev pytest"
                        withCredentials([
                            usernamePassword(credentialsId: 'gh-pat', usernameVariable: 'OWNER', passwordVariable: 'PAT')
                        ]) {
                            sh 'echo $PAT | docker login ghcr.io -u $OWNER --password-stdin'
                            sh "docker tag ghcr.io/perceptimatic/sfo-shennong-runner:dev ghcr.io/${OWNER}/sfo-shennong-runner:latest"
                            sh "docker push ghcr.io/${OWNER}/sfo-shennong-runner:latest"
                        }
                    }
                }
            }
        }

        stage('Build React App') {
            when {
                anyOf {
                    changeset 'react/**/*'
                    expression { params.FORCE_REACT == true }
                }
            }
            agent {
                docker {
                    image 'node:latest'
                    args '-e AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION} \
                          -e BUCKET_NAME=${BUCKET_NAME} \
                          -v /home/ubuntu/react-assets:$WORKSPACE/react/dist'
                }
            }
            steps {
                dir('react') {
                    sh '''
                        yarn
                        yarn run lint-check
                        yarn run format-check
                        yarn run type-check
                        yarn run build
                    '''
                }
            }
        }
        stage('Deploy React') {
            when {
                anyOf {
                    changeset 'react/**/*'
                    expression { params.FORCE_REACT == true }
                }
            }
            steps {
                withCredentials(bindings: [sshUserPrivateKey(credentialsId: 'jenkins-ssh', \
                    keyFileVariable: 'SSHKEY')]) {
                        sh 'rsync -avh  --delete -e "ssh -o StrictHostKeyChecking=no -i $SSHKEY" /home/ubuntu/react-assets/ jenkins@$HOST:$HOST_PATH/react/dist/'
                    }
            }
        }
        stage('Deploy API') {
            when {
                anyOf {
                    changeset 'api/**/*'
                    expression { params.FORCE_API == true }
                }
            }
            steps {
                withCredentials(bindings: [sshUserPrivateKey(credentialsId: 'jenkins-ssh', \
                    keyFileVariable: 'SSHKEY')]) {
                        sh 'ssh -o StrictHostKeyChecking=no -i $SSHKEY jenkins@$HOST "cd $HOST_PATH; bash deploy-api.sh" '
                    }
            }
        }
        stage('Deploy workers') {
            when {
                anyOf {
                    changeset 'worker/**/*'
                    expression { params.FORCE_WORKER == true }
                }
            }
            steps {
                withCredentials(bindings: [sshUserPrivateKey(credentialsId: 'jenkins-ssh', \
                    keyFileVariable: 'SSHKEY')]) {
                        sh 'ssh -o StrictHostKeyChecking=no -i $SSHKEY jenkins@$HOST "cd $HOST_PATH; bash deploy-workers.sh" '
                    }
            }
        }
    }
}
