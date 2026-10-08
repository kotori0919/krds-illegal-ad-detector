use std::path::Path;

pub fn validate_workbook(data: &[u8]) -> Result<(), String> {
    if data.len() < 1024 || data.len() > 24 * 1024 * 1024 || !data.starts_with(b"PK\x03\x04") {
        return Err("invalid or oversized XLSX report".to_string());
    }
    Ok(())
}

/// Commit only a complete report; failed writes leave the prior destination intact.
pub fn write_workbook(path: &Path, data: &[u8]) -> Result<(), String> {
    validate_workbook(data)?;
    let temporary = path.with_file_name(format!(".krds-report-{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(&temporary)?;
        file.write_all(data)?;
        file.sync_all()?;
        drop(file);
        std::fs::rename(&temporary, path)
    })();
    if let Err(error) = result {
        let _ = std::fs::remove_file(&temporary);
        return Err(format!("report save failed: {error}"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invalid_report_preserves_existing_file_and_complete_write_is_atomic() {
        let directory = std::env::temp_dir().join(format!("krds-report-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&directory).unwrap();
        let target = directory.join("report.xlsx");
        std::fs::write(&target, b"previous report").unwrap();
        assert!(write_workbook(&target, b"not an XLSX").is_err());
        assert_eq!(std::fs::read(&target).unwrap(), b"previous report");
        let mut data = vec![0; 1024]; data[..4].copy_from_slice(b"PK\x03\x04");
        write_workbook(&target, &data).unwrap();
        assert_eq!(std::fs::read(&target).unwrap(), data);
        assert_eq!(std::fs::read_dir(&directory).unwrap().count(), 1);
        std::fs::remove_dir_all(directory).unwrap();
    }
}
