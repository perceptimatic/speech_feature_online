from app.analyse import LocalFileManager


def test_tmp_file_paths(tmpdir):
    tmp_path = tmpdir / "fm-test"
    fm = LocalFileManager(tmp_path)
    assert fm.tmp_dir == str(tmp_path)
    assert str(tmp_path) in fm.outer_results_dir
    assert str(tmp_path) in fm.results_dir
    assert "sfo-results" in fm.results_dir
    assert str(tmp_path) in fm.tmp_download_dir
