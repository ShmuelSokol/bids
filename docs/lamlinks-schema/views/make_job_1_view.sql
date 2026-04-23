-- dbo.make_job_1_view



/* view make_job_1_view: add view */


/* view make_job_1_view: add view */


/* view make_job_1_view: add view */

/* view make_job_1_view: add view */


/* view make_job_1_view: add view */


/* view make_job_1_view: add view */


/* view make_job_1_view: add view */


/* view make_job_1_view: add view */


/* view make_job_1_view: add view */


/* view make_job_1_view: add view */
/* view make_job_1_view: add view 
 view make_job_1_view: add view 
 view make_job_1_view: add view 
 view make_job_1_view: add view 
 view make_job_1_view: add view 
 view make_job_1_view: add view 
 view make_job_1_view: add view 
 view make_job_1_view: add view */
CREATE VIEW [dbo].[make_job_1_view]
AS
SELECT        dbo.job_basic_1_view.job_no_ka8, dbo.job_basic_1_view.jln_no_ka9, dbo.job_basic_1_view.jlndte_ka9, dbo.job_basic_1_view.jrqpur_ka9, dbo.job_basic_1_view.jlnqty_ka9, dbo.job_basic_1_view.jlnsta_ka9, 
                         dbo.make_clin_1_view.cntrct_k79, dbo.make_clin_1_view.rel_no_k80, dbo.make_clin_1_view.clinno_k81, dbo.make_clin_1_view.e_code_mfg, dbo.make_clin_1_view.prtnum_k71, 
                         dbo.make_clin_1_view.pn_rev_k71, dbo.make_clin_1_view.p_desc_k71, dbo.make_clin_1_view.fsc_k08, dbo.make_clin_1_view.niin_k08, dbo.make_clin_1_view.prjnam_k73, 
                         dbo.make_clin_1_view.bv_num_kd2, dbo.make_clin_1_view.bvstat_kd2, dbo.make_clin_1_view.idnk08_k08, dbo.make_clin_1_view.idnk71_k71, dbo.make_clin_1_view.idnk73_k73, 
                         dbo.make_clin_1_view.idnk81_k81, dbo.job_basic_1_view.idnka9_ka9, dbo.job_basic_1_view.idnka8_ka8, dbo.make_clin_1_view.piidno_k80
FROM            dbo.make_clin_1_view INNER JOIN
                         dbo.job_basic_1_view ON dbo.make_clin_1_view.idnk81_k81 = dbo.job_basic_1_view.idnk81_k81
WHERE        (dbo.job_basic_1_view.jrqpur_ka9 = 'Make')










