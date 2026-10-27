#[cfg(all(target_os = "linux", target_pointer_width = "64"))]
#[path = "build_support/resource_stage.rs"]
mod resource_stage;

fn main() {
    println!("cargo:rerun-if-env-changed=KRDS_BOUNDED_RESOURCE_STAGE");
    match std::env::var_os("KRDS_BOUNDED_RESOURCE_STAGE") {
        None => tauri_build::build(),
        Some(value) if value == "1" => {
            #[cfg(all(target_os = "linux", target_pointer_width = "64"))]
            if let Err(error) = resource_stage::build() {
                panic!("bounded resource staging failed: {error}");
            }
            #[cfg(not(all(target_os = "linux", target_pointer_width = "64")))]
            panic!("bounded resource staging is Linux64-only; unset KRDS_BOUNDED_RESOURCE_STAGE");
        }
        Some(_) => panic!("KRDS_BOUNDED_RESOURCE_STAGE must be unset or exactly 1"),
    }
}
