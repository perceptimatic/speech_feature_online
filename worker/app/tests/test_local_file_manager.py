import pytest
from os import path
from pathlib import Path
from unittest.mock import MagicMock

from app.analyse import LocalFileManager


@pytest.fixture()
def local_file_manager(tmpdir):
    """We'll patch the instance's temp dir with pytest's"""
    fm = LocalFileManager()
    fm.tmp_dir = str(tmpdir)
    return fm


def test_load(local_file_manager: LocalFileManager, tmp_path):
    """Test that we can read from tmp dir and dir is registered as tmp"""
    pth = local_file_manager.load(tmp_path)
    assert pth in local_file_manager.input_paths
    assert pth == tmp_path


def test_make_tmp_dir(local_file_manager: LocalFileManager):
    """Test that we can make a tmp dir and it is not registerd"""
    tmp_dr = local_file_manager.make_tmp_dir()
    assert local_file_manager.tmp_dir in path.dirname(tmp_dr)
    assert tmp_dr not in local_file_manager.input_paths
    assert tmp_dr not in local_file_manager.results_dir
    assert path.exists(tmp_dr)


def test_register_result_dir(local_file_manager: LocalFileManager):
    """Test that the directory path is registered to pass to Shennong
    but is not created
    Note that Shennong will raise an IOError if the file exists
    https://github.com/bootphon/shennong/blob/master/shennong/features_collection.py#L141
    """
    result_dir = local_file_manager.register_result_dir()
    assert local_file_manager.tmp_dir in path.dirname(result_dir)
    assert not path.exists(result_dir)
    assert result_dir in local_file_manager.result_dirs


def test_register_result_path(local_file_manager: LocalFileManager):
    """Test that directory is registered and path is returned
    for passing to Shennong but neither is created
    """
    result_path = local_file_manager.register_result_path("foobar", "abc")
    assert local_file_manager.tmp_dir in path.dirname(result_path)
    assert "foobar" in result_path
    assert not path.exists(result_path)
    assert path.dirname(result_path) in local_file_manager.result_dirs


def test_remove_temps(local_file_manager: LocalFileManager, tmp_path):
    """Test that directory is registered and path is returned
    for passing to Shennong but neither is created
    """
    input = Path(local_file_manager.load(str(tmp_path))).joinpath("foo.tst")
    input.touch()
    assert path.dirname(input) in local_file_manager.input_paths
    result_path = local_file_manager.register_result_path(tmp_path, ".tst")
    assert path.dirname(result_path) in local_file_manager.result_dirs
    result = Path(result_path)
    result.touch()
    local_file_manager.remove_temps()
    for dir in [*local_file_manager.input_paths, *local_file_manager.result_dirs]:
        assert not path.exists(dir)


def test_context_manager(local_file_manager):
    """Test that remove_temps is called on __exit__"""
    local_file_manager.remove_temps = MagicMock()
    with pytest.raises(RuntimeError):
        with local_file_manager:
            raise RuntimeError

    with local_file_manager:
        pass

    assert local_file_manager.remove_temps.call_count == 2
