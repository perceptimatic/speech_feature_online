import React from 'react';
import { Box, Typography } from '@mui/material';

interface PageProps {
    title?: string;
}

const Page: React.FC<PageProps> = ({ children, title }) => (
    <Box marginTop={3}>
        {title && (
            <Box sx={{ margin: 1 }}>
                <Typography align="center" variant="h3">
                    {title}
                </Typography>
            </Box>
        )}
        {children}
    </Box>
);

export default Page;
