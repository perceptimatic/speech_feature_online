import React from 'react';
import { Grid, Link } from '@mui/material';
import styled from '@emotion/styled';
import { Page } from '../Components';
import docs from '../../docs/overview.md';

const AboutPage: React.FC = () => (
    <Page title="About">
        <Grid container direction="column">
            <Grid item>
                Speech Features Online allows users to upload audio files for
                analysis by the{' '}
                <Link href="https://docs.cognitive-ml.fr/shennong/">
                    Shennong
                </Link>{' '}
                feature extraction software. The analysis runs aynchronously on
                a dedicated server, and the results are sent to the email
                address associated with the user's account.
            </Grid>
            <Grid item>
                <PrintMarkdown html={docs} />
            </Grid>
        </Grid>
    </Page>
);

export default AboutPage;

interface PrintMarkdownProps {
    html: string;
}

const PrintMarkdown: React.FC<PrintMarkdownProps> = ({ html }) => (
    <MarkdownContainer dangerouslySetInnerHTML={{ __html: html }} />
);

const MarkdownContainer = styled.div`
    table {
        border-collapse: collapse;
        border: 1px solid black;
    }

    table td {
        padding: 5px;
        border: 1px solid black;
    }
`;
