-- dbo.clin_part_1_view



/* view clin_part_1_view: add view */


/* view clin_part_1_view: add view */


/* view clin_part_1_view: add view */

/* view clin_part_1_view: add view */


/* view clin_part_1_view: add view */


/* view clin_part_1_view: add view */


/* view clin_part_1_view: add view */


/* view clin_part_1_view: add view */


/* view clin_part_1_view: add view */


/* view clin_part_1_view: add view */
/* view clin_part_1_view: add view 
 view clin_part_1_view: add view 
 view clin_part_1_view: add view 
 view clin_part_1_view: add view 
 view clin_part_1_view: add view 
 view clin_part_1_view: add view 
 view clin_part_1_view: add view 
 view clin_part_1_view: add view */
CREATE VIEW [dbo].[clin_part_1_view]
AS
SELECT        dbo.clin_basic_1_view.cntrct_k79, dbo.clin_basic_1_view.rel_no_k80, dbo.clin_basic_1_view.clinno_k81, dbo.k85_tab.adddte_k85, dbo.clin_basic_1_view.cage_k13 AS m_code_cln, 
                         dbo.clin_basic_1_view.prtnum_k71 AS prtnum_cln, dbo.clin_basic_1_view.p_desc_k71 AS p_desc_cln, dbo.clin_basic_1_view.fsc_k08 AS fsc_cln, dbo.clin_basic_1_view.niin_k08 AS niin_cln, 
                         dbo.part_2_view.e_code_mfg AS m_code_prt, dbo.part_2_view.prtnum_k71 AS prtnum_prt, dbo.part_2_view.p_desc_k71 AS p_desc_prt, dbo.part_2_view.fsc_k08 AS fsc_prt, dbo.part_2_view.niin_k08 AS niin_prt, 
                         dbo.clin_basic_1_view.idnk08_k08 AS idnk08_cln, dbo.clin_basic_1_view.idnk71_k71 AS idnk71_cln, dbo.part_2_view.idnk08_k08 AS idnk08_prt, dbo.part_2_view.idnk71_k71 AS idnk71_prt, 
                         dbo.clin_basic_1_view.idnk81_k81, dbo.k84_tab.idnk84_k84, dbo.k85_tab.idnk85_k85, dbo.k84_tab.cnq_01_k84, dbo.k85_tab.cnq_01_k85, dbo.k84_tab.mkq_01_k84, dbo.k85_tab.mkq_01_k85, 
                         dbo.k84_tab.rnq_01_k84, dbo.k85_tab.rnq_01_k85, dbo.k84_tab.snq_01_k84, dbo.k85_tab.snq_01_k85, dbo.k84_tab.slq_01_k84, dbo.part_2_view.p_um_k71 AS p_um_prt, 
                         dbo.part_2_view.pn_rev_k71 AS pn_rev_prt, dbo.k85_tab.dlydte_k85, dbo.clin_basic_1_view.mrqsta_k81, dbo.clin_basic_1_view.idnk79_k79, dbo.k84_tab.sop_um_k84, dbo.clin_basic_1_view.piidno_k80
FROM            dbo.k84_tab INNER JOIN
                         dbo.k85_tab ON dbo.k84_tab.idnk84_k84 = dbo.k85_tab.idnk84_k85 INNER JOIN
                         dbo.part_2_view ON dbo.k84_tab.idnk71_k84 = dbo.part_2_view.idnk71_k71 INNER JOIN
                         dbo.clin_basic_1_view ON dbo.k85_tab.idnk81_k85 = dbo.clin_basic_1_view.idnk81_k81










