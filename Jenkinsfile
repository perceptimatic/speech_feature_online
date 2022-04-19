pipeline {
    agent any
    environment {
        HOST_PATH = credentials('host-path')
        HOST = credentials('host')
    }
    stages {
        stage('Clone repository') {
            steps {
                checkout scm
            }
        }
        stage('Test, Build, Push, and Restart API') {
            when { changeset 'api/**/*' }
            steps {
                dir('api') {
                    script {
                        docker.build('sfo-api:dev')
                        sh "docker run --entrypoint='' sfo-api:dev black --check app"
                        withCredentials([
                            usernamePassword(credentialsId: 'gh-pat', usernameVariable: 'OWNER', passwordVariable: 'PAT')
                        ]) {
                            sh 'echo $PAT | docker login ghcr.io -u $OWNER --password-stdin'
                            sh "docker tag sfo-api:dev ghcr.io/${OWNER}/sfo-api:latest"
                            sh "docker push ghcr.io/${OWNER}/sfo-api:latest"
                        }
                        withCredentials(bindings: [sshUserPrivateKey(credentialsId: 'jenkins-ssh', \
                                             keyFileVariable: 'SSHKEY')]) {
                            sh 'ssh -o StrictHostKeyChecking=no -i $SSHKEY jenkins@$HOST "cd $HOST_PATH; bash deploy.sh api" '
                                             }
                    }
                }
            }
        }

        stage('Test, Build, Push, and Restart Worker') {
            when { changeset 'worker/**/*' }
            steps {
                dir('worker') {
                    script {
                        docker.build('sfo-worker:dev')
                        sh "docker run --rm --entrypoint='' sfo-worker:dev black --check app"
                        sh "docker run --entrypoint='' sfo-worker:dev pytest"
                        withCredentials([
                            usernamePassword(credentialsId: 'gh-pat', usernameVariable: 'OWNER', passwordVariable: 'PAT')
                        ]) {
                            sh 'echo $PAT | docker login ghcr.io -u $OWNER --password-stdin'
                            sh "docker tag sfo-worker:dev ghcr.io/${OWNER}/sfo-worker:latest"
                            sh "docker push ghcr.io/${OWNER}/sfo-worker:latest"
                        }
                        withCredentials(bindings: [sshUserPrivateKey(credentialsId: 'jenkins-ssh', \
                                             keyFileVariable: 'SSHKEY')]) {
                            sh 'ssh -o StrictHostKeyChecking=no -i $SSHKEY jenkins@$HOST "cd $HOST_PATH; bash deploy.sh worker" '
                                             }
                    }
                }
            }
        }

        stage('Build React App') {
            when { changeset 'react/**/*' }
            agent {
                docker {
                    image 'node:latest'
                    args '-e AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION \
                          -e BUCKET_NAME=$BUCKET_NAME \
                          -e REACT_TMP_CRED_ENDPOINT=$REACT_TMP_CRED_ENDPOINT \
                          -e STORAGE_DRIVER=$STORAGE_DRIVER'
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
        stage('Deploy React App') {
            when { changeset 'react/**/*' }
            agent any
            steps {
                    withCredentials(bindings: [sshUserPrivateKey(credentialsId: 'jenkins-ssh', \
                        keyFileVariable: 'SSHKEY')]) {
                            sh 'rsync -avh -e "ssh -o StrictHostKeyChecking=no -i $SSHKEY" ./react/dist jenkins@$HOST:$HOST_PATH/react/'
                        }
            }
        }
        stage('Prune stale and ephemeral objects') {
            steps {
                sh 'docker image prune -af'
                sh 'docker container prune -f'
            }
        }
    }
}