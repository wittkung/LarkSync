// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

use anyhow::Result;
use std::fs::File;
use tar::Builder;
use zstd::Encoder;

/// Zero-copy in-memory streaming archive packer (TAR.ZSTD).
pub struct StreamingArchivePacker {
    tar_builder: Builder<Encoder<'static, File>>,
}

impl StreamingArchivePacker {
    pub fn create(output_path: &str, compression_level: i32) -> Result<Self> {
        let file = File::create(output_path)?;
        let zstd_encoder = Encoder::new(file, compression_level)?;
        let tar_builder = Builder::new(zstd_encoder);

        Ok(Self { tar_builder })
    }

    /// Appends single file slice data into archive without disk intermediate storage.
    pub fn append_file_data(&mut self, virtual_path: &str, data: &[u8]) -> Result<()> {
        let mut header = tar::Header::new_gnu();
        header.set_size(data.len() as u64);
        header.set_mode(0o644);
        header.set_cksum();

        self.tar_builder.append_data(&mut header, virtual_path, data)?;
        Ok(())
    }

    /// Finishes archive packing and flushes underlying buffers.
    pub fn finish(self) -> Result<()> {
        let zstd_encoder = self.tar_builder.into_inner()?;
        zstd_encoder.finish()?;
        Ok(())
    }
}

