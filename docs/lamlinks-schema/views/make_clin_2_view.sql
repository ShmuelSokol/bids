-- dbo.make_clin_2_view



/* view make_clin_2_view: add view */


/* view make_clin_2_view: add view */


/* view make_clin_2_view: add view */

/* view make_clin_2_view: add view */


/* view make_clin_2_view: add view */


/* view make_clin_2_view: add view */


/* view make_clin_2_view: add view */


/* view make_clin_2_view: add view */


/* view make_clin_2_view: add view */


/* view make_clin_2_view: add view */
/* view make_clin_2_view: add view 
 view make_clin_2_view: add view 
 view make_clin_2_view: add view 
 view make_clin_2_view: add view 
 view make_clin_2_view: add view 
 view make_clin_2_view: add view 
 view make_clin_2_view: add view 
 view make_clin_2_view: add view */
CREATE VIEW [dbo].[make_clin_2_view]
AS
SELECT        dbo.make_clin_1_view.cntrct_k79, dbo.make_clin_1_view.rel_no_k80, dbo.make_clin_1_view.clinno_k81, dbo.make_clin_1_view.e_code_mfg, dbo.make_clin_1_view.prtnum_k71, 
                         dbo.make_clin_1_view.pn_rev_k71, dbo.make_clin_1_view.p_desc_k71, dbo.make_clin_1_view.fsc_k08, dbo.make_clin_1_view.niin_k08, dbo.make_clin_1_view.prjnam_k73, 
                         dbo.make_clin_1_view.bv_num_kd2, dbo.make_clin_1_view.bvstat_kd2, dbo.make_clin_1_view.idnk08_k08, dbo.make_clin_1_view.idnk71_k71, dbo.make_clin_1_view.idnk81_k81, 
                         dbo.make_clin_1_view.idnk73_k73, dbo.make_clin_1_view.idnkau_kau, dbo.make_clin_1_view.idnk79_k79, dbo.make_clin_1_view.adddte_kau, dbo.make_clin_1_view.clnqty_k81, 
                         dbo.clin_part_1_view.cnq_01_k85, dbo.clin_part_1_view.mkq_01_k85, dbo.clin_part_1_view.rnq_01_k85, dbo.clin_part_1_view.snq_01_k85, dbo.make_clin_1_view.piidno_k80
FROM            dbo.make_clin_1_view LEFT OUTER JOIN
                         dbo.clin_part_1_view ON dbo.clin_part_1_view.idnk81_k81 = dbo.make_clin_1_view.idnk81_k81 AND dbo.make_clin_1_view.idnk71_k71 = dbo.clin_part_1_view.idnk71_prt










